import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AppDatabase } from '../../db/index.ts';
import {
  areaManagers,
  branchCredentials,
  branches,
  unconfiguredBranches,
} from '../../db/schema.ts';
import {
  buildClearSessionCookie,
  buildSessionCookie,
  hashSecret,
  verifySecret,
} from '../security/crypto.ts';
import { writeAuditLog } from '../security/audit.ts';
import { DatabaseRateLimitStore } from '../security/rateLimit.ts';
import { DatabaseSessionStore } from '../security/sessions.ts';
import { getClientIp, requireAuth, type AppRequest } from '../middleware/auth.ts';

const loginBranchSchema = z
  .object({
    branchName: z.string().trim().min(1).max(200),
    branchCode: z.string().trim().min(1).max(60),
    accessCode: z.string().min(1).max(200).optional(),
  })
  .strict();

const CLAIM_CODE_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

const loginAreaSchema = z
  .object({
    username: z.string().trim().min(1).max(120),
    password: z.string().min(1).max(200),
  })
  .strict();

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z.string().min(12).max(200),
  })
  .strict();

const LOGIN_RATE_POLICY = {
  scope: 'auth_login',
  maxHits: 5,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
};

function isSecureRequest(req: AppRequest): boolean {
  if (req.secure) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  return (
    proto.includes('https') ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

export function createAuthRouter(): Router {
  const router = Router();

  // Public catalog: returns active branch display names (no secrets) + unconfigured branch names
  router.get('/branches', async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const activeRows = await db
        .select({
          code: branches.code,
          name: branches.name,
          nameAr: branches.nameAr,
          city: branches.city,
          cityAr: branches.cityAr,
          area: branches.area,
        })
        .from(branches)
        .where(eq(branches.isActive, true));

      const unconfiguredRows = await db
        .select({
          branchName: unconfiguredBranches.branchName,
          displayOrder: unconfiguredBranches.displayOrder,
          statusNote: unconfiguredBranches.statusNote,
        })
        .from(unconfiguredBranches);

      unconfiguredRows.sort((a, b) => a.displayOrder - b.displayOrder);

      res.json({
        configuredBranches: activeRows,
        unconfiguredBranches: unconfiguredRows,
      });
    } catch (err) {
      next(err);
    }
  });

  // Store Manager login: Branch Name (dropdown) + Branch Code (password).
  // For unconfigured branches, first login with a valid Branch Code atomically saves it for future logins.
  router.post('/login-branch', async (req: AppRequest, res, next) => {
    try {
      const parsed = loginBranchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Select a branch and enter the Branch Code.' });
        return;
      }

      const db = req.db!;
      const ip = getClientIp(req);
      const branchName = parsed.data.branchName.trim();
      const enteredCode = parsed.data.branchCode.trim();
      const enteredSecret = (parsed.data.accessCode ?? parsed.data.branchCode).trim();
      const rateLimiter = new DatabaseRateLimitStore(db);
      const bucketKey = `auth:branch:${ip}:${branchName.toLowerCase()}`;

      const rateDecision = await rateLimiter.checkAndConsume(bucketKey, LOGIN_RATE_POLICY);
      if (!rateDecision.allowed) {
        res.setHeader('Retry-After', String(rateDecision.retryAfterSeconds));
        res.status(429).json({
          error: `Too many failed sign-in attempts. Retry in ${rateDecision.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateDecision.retryAfterSeconds,
        });
        return;
      }

      const findActiveBranchByName = async () => {
        const activeBranches = await db
          .select()
          .from(branches)
          .where(eq(branches.isActive, true));
        return activeBranches.find(
          (b) => b.name.trim().toLowerCase() === branchName.toLowerCase()
        );
      };

      let branch = await findActiveBranchByName();

      // If branch is in the unconfigured catalog, claim & save its Branch Code on first login
      if (!branch) {
        const allUnconfigured = await db.select().from(unconfiguredBranches);
        const unconfiguredRow = allUnconfigured.find(
          (u) => u.branchName.trim().toLowerCase() === branchName.toLowerCase()
        );

        if (!unconfiguredRow) {
          await writeAuditLog(db, {
            actorType: 'ANONYMOUS',
            actorRole: null,
            actorIdentifier: branchName,
            branchCode: enteredCode,
            action: 'LOGIN_BRANCH_FAILED',
            domain: 'auth',
            details: { reason: 'branch_not_found' },
            ipAddress: ip,
          });
          res.status(401).json({ error: 'Invalid branch selection or branch code.' });
          return;
        }

        if (!CLAIM_CODE_PATTERN.test(enteredCode) || enteredSecret !== enteredCode) {
          res.status(400).json({
            error: 'Branch Code must be 3 to 20 alphanumeric characters (letters, numbers, - or _).',
          });
          return;
        }

        const now = new Date();
        const todayIso = now.toISOString().slice(0, 10);

        const claimResult = await db.transaction(async (tx) => {
          const deleted = await tx
            .delete(unconfiguredBranches)
            .where(eq(unconfiguredBranches.id, unconfiguredRow.id))
            .returning();

          if (deleted.length === 0) {
            return { status: 'concurrent_claim' as const };
          }

          const [codeOwner] = await tx
            .select({ code: branches.code, name: branches.name })
            .from(branches)
            .where(eq(branches.code, enteredCode));

          if (codeOwner) {
            throw Object.assign(new Error('BRANCH_CODE_COLLISION'), { isBranchCodeCollision: true });
          }

          const [createdBranch] = await tx
            .insert(branches)
            .values({
              code: enteredCode,
              storeId: enteredCode,
              name: unconfiguredRow.branchName,
              nameAr: unconfiguredRow.branchName,
              city: '',
              cityAr: '',
              managerName: 'Store Manager',
              managerNameAr: 'مدير الفرع',
              area: '',
              businessDate: todayIso,
              totalShifts: 25,
              remainingShifts: 10,
              targetDailyRevenue: 0,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          const [createdCred] = await tx
            .insert(branchCredentials)
            .values({
              branchCode: enteredCode,
              codeHash: hashSecret(enteredCode),
              isActive: true,
              tokenVersion: 1,
              failedAttempts: 0,
              lastRotatedAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning();

          await writeAuditLog(tx as unknown as AppDatabase, {
            actorType: 'STORE_MANAGER',
            actorRole: 'STORE_MANAGER',
            actorIdentifier: unconfiguredRow.branchName,
            branchCode: enteredCode,
            action: 'CLAIM_BRANCH_ON_FIRST_LOGIN',
            domain: 'branches',
            recordId: enteredCode,
            details: { branchName: unconfiguredRow.branchName },
            ipAddress: ip,
          });

          return { status: 'claimed' as const, branch: createdBranch, cred: createdCred };
        }).catch((err) => {
          if (err && typeof err === 'object' && 'isBranchCodeCollision' in err) {
            return { status: 'code_collision' as const };
          }
          throw err;
        });

        if (claimResult.status === 'code_collision') {
          res.status(409).json({
            error: 'This branch code is already assigned to another branch.',
          });
          return;
        }

        if (claimResult.status === 'concurrent_claim') {
          branch = await findActiveBranchByName();
          if (!branch) {
            res.status(401).json({ error: 'Invalid branch selection or branch code.' });
            return;
          }
        } else {
          await rateLimiter.reset(bucketKey);
          const sessionStore = new DatabaseSessionStore(db);
          const { rawToken, expiresAt } = await sessionStore.createStoreManagerSession({
            branchCode: claimResult.branch.code,
            tokenVersion: claimResult.cred.tokenVersion,
            ipAddress: ip,
            userAgent: String(req.headers['user-agent'] || ''),
          });
          const principal = await sessionStore.validateSessionToken(rawToken);
          await writeAuditLog(db, {
            actorType: 'STORE_MANAGER',
            actorRole: 'STORE_MANAGER',
            actorIdentifier: claimResult.branch.managerName || claimResult.branch.name,
            branchCode: claimResult.branch.code,
            action: 'LOGIN',
            domain: 'auth',
            ipAddress: ip,
          });
          res.setHeader(
            'Set-Cookie',
            buildSessionCookie(rawToken, { secure: isSecureRequest(req) })
          );
          res.json({ user: principal, expiresAt: expiresAt.toISOString(), claimedFirstLogin: true });
          return;
        }
      }

      // Existing configured branch verification
      if (enteredCode !== branch.code) {
        await writeAuditLog(db, {
          actorType: 'ANONYMOUS',
          actorRole: null,
          actorIdentifier: branch.name,
          branchCode: branch.code,
          action: 'LOGIN_BRANCH_FAILED',
          domain: 'auth',
          details: { reason: 'branch_code_mismatch' },
          ipAddress: ip,
        });
        res.status(401).json({ error: 'Invalid branch selection or branch code.' });
        return;
      }

      let [cred] = await db
        .select()
        .from(branchCredentials)
        .where(and(eq(branchCredentials.branchCode, branch.code), eq(branchCredentials.isActive, true)));

      // If a pre-seeded verified branch (e.g. 1750) has no credential row yet,
      // activate it on first login with its verified branch code.
      if (!cred) {
        const [anyCred] = await db
          .select()
          .from(branchCredentials)
          .where(eq(branchCredentials.branchCode, branch.code));

        if (anyCred && !anyCred.isActive) {
          await writeAuditLog(db, {
            actorType: 'ANONYMOUS',
            actorRole: null,
            actorIdentifier: branch.name,
            branchCode: branch.code,
            action: 'LOGIN_BRANCH_FAILED',
            domain: 'auth',
            details: { reason: 'branch_credential_revoked' },
            ipAddress: ip,
          });
          res.status(401).json({ error: 'Invalid branch selection or branch code.' });
          return;
        }

        if (enteredSecret !== branch.code) {
          await writeAuditLog(db, {
            actorType: 'ANONYMOUS',
            actorRole: null,
            actorIdentifier: branch.name,
            branchCode: branch.code,
            action: 'LOGIN_BRANCH_FAILED',
            domain: 'auth',
            details: { reason: 'invalid_initial_branch_code' },
            ipAddress: ip,
          });
          res.status(401).json({ error: 'Invalid branch selection or branch code.' });
          return;
        }

        const now = new Date();
        const [insertedCred] = await db
          .insert(branchCredentials)
          .values({
            branchCode: branch.code,
            codeHash: hashSecret(branch.code),
            isActive: true,
            tokenVersion: 1,
            failedAttempts: 0,
            lastRotatedAt: now,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing({ target: branchCredentials.branchCode })
          .returning();

        if (insertedCred) {
          cred = insertedCred;
          await writeAuditLog(db, {
            actorType: 'STORE_MANAGER',
            actorRole: 'STORE_MANAGER',
            actorIdentifier: branch.managerName || branch.name,
            branchCode: branch.code,
            action: 'ACTIVATE_BRANCH_ON_FIRST_LOGIN',
            domain: 'branch_credentials',
            recordId: branch.code,
            ipAddress: ip,
          });
        } else {
          const [refetched] = await db
            .select()
            .from(branchCredentials)
            .where(and(eq(branchCredentials.branchCode, branch.code), eq(branchCredentials.isActive, true)));
          cred = refetched;
        }
      }

      if (!cred || !verifySecret(enteredSecret, cred.codeHash)) {
        if (cred) {
          await db
            .update(branchCredentials)
            .set({ failedAttempts: cred.failedAttempts + 1, updatedAt: new Date() })
            .where(eq(branchCredentials.id, cred.id));
        }
        await writeAuditLog(db, {
          actorType: 'ANONYMOUS',
          actorRole: null,
          actorIdentifier: branch.name,
          branchCode: branch.code,
          action: 'LOGIN_BRANCH_FAILED',
          domain: 'auth',
          details: { reason: 'invalid_branch_or_access_code' },
          ipAddress: ip,
        });
        res.status(401).json({ error: 'Invalid branch selection or branch code.' });
        return;
      }

      await rateLimiter.reset(bucketKey);
      if (cred.failedAttempts > 0) {
        await db
          .update(branchCredentials)
          .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
          .where(eq(branchCredentials.id, cred.id));
      }

      const sessionStore = new DatabaseSessionStore(db);
      const { rawToken, expiresAt } = await sessionStore.createStoreManagerSession({
        branchCode: branch.code,
        tokenVersion: cred.tokenVersion,
        ipAddress: ip,
        userAgent: String(req.headers['user-agent'] || ''),
      });

      const principal = await sessionStore.validateSessionToken(rawToken);
      await writeAuditLog(db, {
        actorType: 'STORE_MANAGER',
        actorRole: 'STORE_MANAGER',
        actorIdentifier: branch.managerName || branch.name,
        branchCode: branch.code,
        action: 'LOGIN',
        domain: 'auth',
        ipAddress: ip,
      });

      res.setHeader(
        'Set-Cookie',
        buildSessionCookie(rawToken, { secure: isSecureRequest(req) })
      );
      res.json({ user: principal, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      next(err);
    }
  });

  // Area Manager login: username + password
  router.post('/login-area', async (req: AppRequest, res, next) => {
    try {
      const parsed = loginAreaSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Enter both username and password.' });
        return;
      }

      const db = req.db!;
      const ip = getClientIp(req);
      const usernameNorm = parsed.data.username.toLowerCase();
      const rateLimiter = new DatabaseRateLimitStore(db);
      const bucketKey = `auth:area:${ip}:${usernameNorm}`;

      const rateDecision = await rateLimiter.checkAndConsume(bucketKey, LOGIN_RATE_POLICY);
      if (!rateDecision.allowed) {
        res.setHeader('Retry-After', String(rateDecision.retryAfterSeconds));
        res.status(429).json({
          error: `Too many failed sign-in attempts. Retry in ${rateDecision.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateDecision.retryAfterSeconds,
        });
        return;
      }

      const [am] = await db
        .select()
        .from(areaManagers)
        .where(and(eq(areaManagers.usernameNormalized, usernameNorm), eq(areaManagers.isActive, true)));

      if (!am || !verifySecret(parsed.data.password, am.passwordHash)) {
        if (am) {
          await db
            .update(areaManagers)
            .set({ failedAttempts: am.failedAttempts + 1, updatedAt: new Date() })
            .where(eq(areaManagers.id, am.id));
        }
        await writeAuditLog(db, {
          actorType: 'ANONYMOUS',
          actorRole: null,
          actorIdentifier: parsed.data.username,
          action: 'LOGIN_AREA_FAILED',
          domain: 'auth',
          ipAddress: ip,
        });
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      await rateLimiter.reset(bucketKey);
      if (am.failedAttempts > 0) {
        await db
          .update(areaManagers)
          .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
          .where(eq(areaManagers.id, am.id));
      }

      const sessionStore = new DatabaseSessionStore(db);
      const { rawToken, expiresAt } = await sessionStore.createAreaManagerSession({
        areaManagerId: am.id,
        tokenVersion: am.tokenVersion,
        ipAddress: ip,
        userAgent: String(req.headers['user-agent'] || ''),
      });

      const principal = await sessionStore.validateSessionToken(rawToken);
      await writeAuditLog(db, {
        actorType: 'AREA_MANAGER',
        actorRole: 'AREA_MANAGER',
        actorIdentifier: am.username,
        action: 'LOGIN',
        domain: 'auth',
        ipAddress: ip,
      });

      res.setHeader(
        'Set-Cookie',
        buildSessionCookie(rawToken, { secure: isSecureRequest(req) })
      );
      res.json({ user: principal, expiresAt: expiresAt.toISOString() });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, (req: AppRequest, res) => {
    res.json({ user: req.principal });
  });

  router.post('/logout', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const principal = req.principal!;
      const sessionStore = new DatabaseSessionStore(db);
      await sessionStore.revokeSessionByToken(req.sessionToken!);

      await writeAuditLog(db, {
        actorType: principal.role,
        actorRole: principal.role,
        actorIdentifier: principal.username,
        branchCode: principal.branchCode,
        action: 'LOGOUT',
        domain: 'auth',
        ipAddress: getClientIp(req),
      });

      res.setHeader('Set-Cookie', buildClearSessionCookie({ secure: isSecureRequest(req) }));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/logout-all', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const db = req.db!;
      const principal = req.principal!;
      const sessionStore = new DatabaseSessionStore(db);
      const now = new Date();

      if (principal.role === 'STORE_MANAGER' && principal.branchCode) {
        await db
          .update(branchCredentials)
          .set({ tokenVersion: sql`${branchCredentials.tokenVersion} + 1`, updatedAt: now })
          .where(eq(branchCredentials.branchCode, principal.branchCode));
        await sessionStore.revokeAllBranchSessions(principal.branchCode, now);
      } else if (principal.role === 'AREA_MANAGER' && principal.areaManagerId) {
        await db
          .update(areaManagers)
          .set({ tokenVersion: sql`${areaManagers.tokenVersion} + 1`, updatedAt: now })
          .where(eq(areaManagers.id, principal.areaManagerId));
        await sessionStore.revokeAllAreaManagerSessions(principal.areaManagerId, now);
      }

      await writeAuditLog(db, {
        actorType: principal.role,
        actorRole: principal.role,
        actorIdentifier: principal.username,
        branchCode: principal.branchCode,
        action: 'LOGOUT_ALL_SESSIONS',
        domain: 'auth',
        ipAddress: getClientIp(req),
      });

      res.setHeader('Set-Cookie', buildClearSessionCookie({ secure: isSecureRequest(req) }));
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  router.post('/change-password', requireAuth, async (req: AppRequest, res, next) => {
    try {
      const principal = req.principal!;
      if (principal.role !== 'AREA_MANAGER' || !principal.areaManagerId) {
        res.status(403).json({
          error: 'Password changes apply only to Area Manager accounts. Branch access codes are managed administratively.',
        });
        return;
      }

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'New password must be at least 12 characters.' });
        return;
      }

      if (parsed.data.newPassword === parsed.data.currentPassword) {
        res.status(400).json({ error: 'New password must differ from current password.' });
        return;
      }

      const db = req.db!;
      const [am] = await db
        .select()
        .from(areaManagers)
        .where(eq(areaManagers.id, principal.areaManagerId));

      if (!am || !verifySecret(parsed.data.currentPassword, am.passwordHash)) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }

      const now = new Date();
      const nextVersion = am.tokenVersion + 1;
      await db
        .update(areaManagers)
        .set({
          passwordHash: hashSecret(parsed.data.newPassword),
          mustRotatePassword: false,
          tokenVersion: nextVersion,
          passwordChangedAt: now,
          updatedAt: now,
        })
        .where(eq(areaManagers.id, am.id));

      const sessionStore = new DatabaseSessionStore(db);
      await sessionStore.revokeAllAreaManagerSessions(am.id, now);
      const { rawToken } = await sessionStore.createAreaManagerSession({
        areaManagerId: am.id,
        tokenVersion: nextVersion,
        ipAddress: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || ''),
        now,
      });

      await writeAuditLog(db, {
        actorType: 'AREA_MANAGER',
        actorRole: 'AREA_MANAGER',
        actorIdentifier: am.username,
        action: 'CHANGE_PASSWORD',
        domain: 'auth',
        ipAddress: getClientIp(req),
      });

      res.setHeader(
        'Set-Cookie',
        buildSessionCookie(rawToken, { secure: isSecureRequest(req) })
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
