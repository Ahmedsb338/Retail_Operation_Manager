import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import type { AppDatabase } from '../../db/index.ts';
import {
  areaManagerAssignments,
  areaManagers,
  branchCredentials,
  branches,
  sessions,
  type AppRole,
} from '../../db/schema.ts';
import {
  generateOpaqueToken,
  hashToken,
  SESSION_TTL_SECONDS,
} from './crypto.ts';

export interface AuthorizedBranchSummary {
  code: string;
  storeId: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  area: string;
  managerName: string;
  managerNameAr: string;
  businessDate: string;
  totalShifts: number;
  remainingShifts: number;
  targetDailyRevenue: number;
}

export interface AuthenticatedPrincipal {
  sessionId: string;
  role: AppRole;
  username: string;
  displayName: string;
  branchCode: string | null;
  storeId: string | null;
  branchName: string | null;
  areaManagerId: string | null;
  mustRotatePassword: boolean;
  assignedAreas: string[];
  authorizedBranches: AuthorizedBranchSummary[];
}

export class DatabaseSessionStore {
  constructor(private readonly db: AppDatabase) {}

  async createStoreManagerSession(params: {
    branchCode: string;
    tokenVersion: number;
    ipAddress: string;
    userAgent: string;
    now?: Date;
  }): Promise<{ rawToken: string; expiresAt: Date }> {
    const now = params.now ?? new Date();
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

    await this.db.insert(sessions).values({
      tokenHash,
      role: 'STORE_MANAGER',
      branchCode: params.branchCode,
      areaManagerId: null,
      tokenVersion: params.tokenVersion,
      ipAddress: params.ipAddress.slice(0, 120),
      userAgent: params.userAgent.slice(0, 300),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
    });

    return { rawToken, expiresAt };
  }

  async createAreaManagerSession(params: {
    areaManagerId: string;
    tokenVersion: number;
    ipAddress: string;
    userAgent: string;
    now?: Date;
  }): Promise<{ rawToken: string; expiresAt: Date }> {
    const now = params.now ?? new Date();
    const rawToken = generateOpaqueToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);

    await this.db.insert(sessions).values({
      tokenHash,
      role: 'AREA_MANAGER',
      branchCode: null,
      areaManagerId: params.areaManagerId,
      tokenVersion: params.tokenVersion,
      ipAddress: params.ipAddress.slice(0, 120),
      userAgent: params.userAgent.slice(0, 300),
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
      revokedAt: null,
    });

    return { rawToken, expiresAt };
  }

  async validateSessionToken(
    rawToken: string,
    now: Date = new Date()
  ): Promise<AuthenticatedPrincipal | null> {
    if (!rawToken) return null;
    const tokenHash = hashToken(rawToken);

    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now)
        )
      );

    const session = rows[0];
    if (!session) return null;

    if (session.role === 'STORE_MANAGER') {
      if (!session.branchCode) return null;

      const [branch] = await this.db
        .select()
        .from(branches)
        .where(and(eq(branches.code, session.branchCode), eq(branches.isActive, true)));

      if (!branch) return null;

      const [cred] = await this.db
        .select()
        .from(branchCredentials)
        .where(
          and(
            eq(branchCredentials.branchCode, session.branchCode),
            eq(branchCredentials.isActive, true)
          )
        );

      if (!cred || cred.tokenVersion !== session.tokenVersion) {
        return null;
      }

      await this.db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.id, session.id));

      const branchSummary: AuthorizedBranchSummary = {
        code: branch.code,
        storeId: branch.storeId,
        name: branch.name,
        nameAr: branch.nameAr,
        city: branch.city,
        cityAr: branch.cityAr,
        area: branch.area,
        managerName: branch.managerName,
        managerNameAr: branch.managerNameAr,
        businessDate: branch.businessDate,
        totalShifts: branch.totalShifts,
        remainingShifts: branch.remainingShifts,
        targetDailyRevenue: branch.targetDailyRevenue,
      };

      return {
        sessionId: session.id,
        role: 'STORE_MANAGER',
        username: branch.managerName || branch.name,
        displayName: branch.managerName || branch.name,
        branchCode: branch.code,
        storeId: branch.storeId,
        branchName: branch.name,
        areaManagerId: null,
        mustRotatePassword: false,
        assignedAreas: branch.area ? [branch.area] : [],
        authorizedBranches: [branchSummary],
      };
    }

    // AREA_MANAGER resolution via explicit DB assignments only (never 'ALL')
    if (!session.areaManagerId) return null;

    const [am] = await this.db
      .select()
      .from(areaManagers)
      .where(and(eq(areaManagers.id, session.areaManagerId), eq(areaManagers.isActive, true)));

    if (!am || am.tokenVersion !== session.tokenVersion) {
      return null;
    }

    const assignments = await this.db
      .select()
      .from(areaManagerAssignments)
      .where(
        and(
          eq(areaManagerAssignments.areaManagerId, am.id),
          eq(areaManagerAssignments.isActive, true),
          isNull(areaManagerAssignments.revokedAt)
        )
      );

    const assignedAreas = Array.from(
      new Set(
        assignments
          .map((a) => a.areaName.trim())
          .filter((a) => a.length > 0 && !['ALL', '*', 'ANY'].includes(a.toUpperCase()))
      )
    );
    const assignedBranchCodes = Array.from(
      new Set(assignments.map((a) => a.branchCode).filter((c): c is string => Boolean(c)))
    );
    const areaOnlyNames = Array.from(
      new Set(
        assignments
          .filter((a) => !a.branchCode)
          .map((a) => a.areaName.trim())
          .filter((a) => a.length > 0 && !['ALL', '*', 'ANY'].includes(a.toUpperCase()))
      )
    );

    let authorizedBranches: AuthorizedBranchSummary[] = [];
    if (assignedBranchCodes.length > 0 || areaOnlyNames.length > 0) {
      const scopeConditions = [];
      if (assignedBranchCodes.length > 0) {
        scopeConditions.push(inArray(branches.code, assignedBranchCodes));
      }
      if (areaOnlyNames.length > 0) {
        scopeConditions.push(inArray(branches.area, areaOnlyNames));
      }

      const branchRows = await this.db
        .select()
        .from(branches)
        .where(
          and(
            eq(branches.isActive, true),
            scopeConditions.length === 1 ? scopeConditions[0] : or(...scopeConditions)
          )
        );

      authorizedBranches = branchRows.map((branch) => ({
        code: branch.code,
        storeId: branch.storeId,
        name: branch.name,
        nameAr: branch.nameAr,
        city: branch.city,
        cityAr: branch.cityAr,
        area: branch.area,
        managerName: branch.managerName,
        managerNameAr: branch.managerNameAr,
        businessDate: branch.businessDate,
        totalShifts: branch.totalShifts,
        remainingShifts: branch.remainingShifts,
        targetDailyRevenue: branch.targetDailyRevenue,
      }));
    }

    await this.db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, session.id));

    return {
      sessionId: session.id,
      role: 'AREA_MANAGER',
      username: am.username,
      displayName: am.displayName,
      branchCode: null,
      storeId: null,
      branchName: null,
      areaManagerId: am.id,
      mustRotatePassword: am.mustRotatePassword,
      assignedAreas,
      authorizedBranches,
    };
  }

  async revokeSessionByToken(rawToken: string, now: Date = new Date()): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.tokenHash, tokenHash), isNull(sessions.revokedAt)));
  }

  async revokeAllBranchSessions(branchCode: string, now: Date = new Date()): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.branchCode, branchCode), isNull(sessions.revokedAt)));
  }

  async revokeAllAreaManagerSessions(areaManagerId: string, now: Date = new Date()): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.areaManagerId, areaManagerId), isNull(sessions.revokedAt)));
  }
}
