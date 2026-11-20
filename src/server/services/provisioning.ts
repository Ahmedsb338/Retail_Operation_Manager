import { and, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../../db/index.ts';
import {
  areaManagerAssignments,
  areaManagers,
  branchCredentials,
  branches,
} from '../../db/schema.ts';
import { hashSecret } from '../security/crypto.ts';
import { writeAuditLog } from '../security/audit.ts';
import { DatabaseSessionStore } from '../security/sessions.ts';

export async function provisionBranchCredential(
  db: AppDatabase,
  params: {
    branchCode: string;
    accessCode: string;
    managerName?: string;
    managerNameAr?: string;
    area?: string;
    actorIdentifier?: string;
  }
): Promise<{ branchCode: string; tokenVersion: number }> {
  const branchCode = params.branchCode.trim();
  const accessCode = params.accessCode.trim();

  if (!branchCode) {
    throw new Error('Branch Code is required.');
  }
  if (accessCode.length < 3) {
    throw new Error('Branch Code / Access Code must be at least 3 characters long.');
  }

  return db.transaction(async (tx) => {
    const [branch] = await tx.select().from(branches).where(eq(branches.code, branchCode));
    if (!branch) {
      throw new Error(`Configured branch "${branchCode}" was not found.`);
    }

    if (params.managerName !== undefined || params.managerNameAr !== undefined || params.area !== undefined) {
      await tx
        .update(branches)
        .set({
          ...(params.managerName !== undefined ? { managerName: params.managerName.trim() } : {}),
          ...(params.managerNameAr !== undefined ? { managerNameAr: params.managerNameAr.trim() } : {}),
          ...(params.area !== undefined ? { area: params.area.trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(branches.code, branchCode));
    }

    const codeHash = hashSecret(accessCode);
    const now = new Date();
    const [existing] = await tx
      .select()
      .from(branchCredentials)
      .where(eq(branchCredentials.branchCode, branchCode));

    let nextVersion = 1;
    if (existing) {
      nextVersion = existing.tokenVersion + 1;
      await tx
        .update(branchCredentials)
        .set({
          codeHash,
          isActive: true,
          tokenVersion: nextVersion,
          failedAttempts: 0,
          lockedUntil: null,
          lastRotatedAt: now,
          updatedAt: now,
        })
        .where(eq(branchCredentials.branchCode, branchCode));
    } else {
      await tx.insert(branchCredentials).values({
        branchCode,
        codeHash,
        isActive: true,
        tokenVersion: 1,
        failedAttempts: 0,
        lastRotatedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const sessionStore = new DatabaseSessionStore(tx as unknown as AppDatabase);
    await sessionStore.revokeAllBranchSessions(branchCode, now);

    await writeAuditLog(tx as unknown as AppDatabase, {
      actorType: 'SYSTEM_CLI',
      actorRole: null,
      actorIdentifier: params.actorIdentifier ?? 'provisioning_service',
      branchCode,
      action: existing ? 'ROTATE_BRANCH_ACCESS_CODE' : 'PROVISION_BRANCH_ACCESS_CODE',
      domain: 'branch_credentials',
      recordId: branchCode,
      details: { tokenVersion: nextVersion },
    });

    return { branchCode, tokenVersion: nextVersion };
  });
}

export async function provisionAreaManager(
  db: AppDatabase,
  params: {
    username: string;
    displayName: string;
    password: string;
    mustRotatePassword?: boolean;
    allowOwnerShortPassword?: boolean;
    assignments: Array<{ areaName: string; branchCode?: string | null }>;
    actorIdentifier?: string;
  }
): Promise<{ id: string; username: string }> {
  const username = params.username.trim();
  const usernameNormalized = username.toLowerCase();
  const displayName = params.displayName.trim() || username;
  const password = String(params.password || '');

  if (!username || username.length < 3) {
    throw new Error('Area Manager username must be at least 3 characters.');
  }
  const minLength = params.allowOwnerShortPassword ? 4 : 12;
  if (password.length < minLength) {
    throw new Error(`Area Manager password must be at least ${minLength} characters.`);
  }
  if (!Array.isArray(params.assignments) || params.assignments.length === 0) {
    throw new Error('At least one explicit area or branch assignment is required.');
  }

  for (const item of params.assignments) {
    const area = String(item.areaName || '').trim();
    if (!area || ['ALL', '*', 'ANY'].includes(area.toUpperCase())) {
      throw new Error(`Invalid area assignment "${area}". Wildcard ALL/* assignments are prohibited.`);
    }
  }

  return db.transaction(async (tx) => {
    const [dup] = await tx
      .select()
      .from(areaManagers)
      .where(eq(areaManagers.usernameNormalized, usernameNormalized));
    if (dup) {
      throw new Error(`Area Manager username "${username}" already exists.`);
    }

    const passwordHash = hashSecret(password);
    const now = new Date();
    const [created] = await tx
      .insert(areaManagers)
      .values({
        username,
        usernameNormalized,
        displayName,
        role: 'AREA_MANAGER',
        passwordHash,
        mustRotatePassword: Boolean(params.mustRotatePassword),
        isActive: true,
        tokenVersion: 1,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    for (const item of params.assignments) {
      await tx.insert(areaManagerAssignments).values({
        areaManagerId: created.id,
        areaName: item.areaName.trim(),
        branchCode: item.branchCode ? item.branchCode.trim() : null,
        isActive: true,
        assignedAt: now,
      });
    }

    await writeAuditLog(tx as unknown as AppDatabase, {
      actorType: 'SYSTEM_CLI',
      actorRole: null,
      actorIdentifier: params.actorIdentifier ?? 'provisioning_service',
      branchCode: null,
      action: 'PROVISION_AREA_MANAGER',
      domain: 'area_managers',
      recordId: created.id,
      details: { username, assignments: params.assignments },
    });

    return { id: created.id, username: created.username };
  });
}

export async function revokeBranchAccess(
  db: AppDatabase,
  branchCode: string,
  actorIdentifier = 'provisioning_service'
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(branchCredentials)
      .set({
        isActive: false,
        tokenVersion: sql`${branchCredentials.tokenVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(branchCredentials.branchCode, branchCode));

    const sessionStore = new DatabaseSessionStore(tx as unknown as AppDatabase);
    await sessionStore.revokeAllBranchSessions(branchCode, now);

    await writeAuditLog(tx as unknown as AppDatabase, {
      actorType: 'SYSTEM_CLI',
      actorRole: null,
      actorIdentifier,
      branchCode,
      action: 'REVOKE_BRANCH_ACCESS',
      domain: 'branch_credentials',
      recordId: branchCode,
    });
  });
}

export async function revokeAreaManagerAccess(
  db: AppDatabase,
  areaManagerId: string,
  actorIdentifier = 'provisioning_service'
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(areaManagers)
      .set({
        isActive: false,
        tokenVersion: sql`${areaManagers.tokenVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(areaManagers.id, areaManagerId));

    await tx
      .update(areaManagerAssignments)
      .set({ isActive: false, revokedAt: now })
      .where(
        and(
          eq(areaManagerAssignments.areaManagerId, areaManagerId),
          eq(areaManagerAssignments.isActive, true)
        )
      );

    const sessionStore = new DatabaseSessionStore(tx as unknown as AppDatabase);
    await sessionStore.revokeAllAreaManagerSessions(areaManagerId, now);

    await writeAuditLog(tx as unknown as AppDatabase, {
      actorType: 'SYSTEM_CLI',
      actorRole: null,
      actorIdentifier,
      branchCode: null,
      action: 'REVOKE_AREA_MANAGER_ACCESS',
      domain: 'area_managers',
      recordId: areaManagerId,
    });
  });
}
