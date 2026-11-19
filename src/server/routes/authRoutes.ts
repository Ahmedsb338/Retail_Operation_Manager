import { Router } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
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
    accessCode: z.string().min(1).max(200),
  })
  .strict();

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
  return proto.includes('https') || process.env.NODE_ENV === 'production';
}

export function createAuthRouter(): Router {
  const router = Router();

  // Public catalog: returns active branch display names (no secrets) + separate unconfigured names
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

  // Store Manager login: requires Branch Name + Branch Code (identifier) + separate Branch Access Code (secret)
  router.post('/login-branch', async (req: AppRequest, res, next) => {
    try {
      const parsed = loginBranchSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Select a branch and enter both Branch Code and Branch Access Code.' });
        return;
      }

      const db = req.db!;
      const ip = getClientIp(req);
      const { branchName, branchCode, accessCode } = parsed.data;
      const rateLimiter = new DatabaseRateLimitStore(db);
      const bucketKey = `auth:branch:${ip}:${branchCode.toLowerCase()}`;

      const rateDecision = await rateLimiter.checkAndConsume(bucketKey, LOGIN_RATE_POLICY);
      if (!rateDecision.allowed) {
        res.setHeader('Retry-After', String(rateDecision.retryAfterSeconds));
        res.status(429).json({
          error: `Too many failed sign-in attempts. Retry in ${rateDecision.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateDecision.retryAfterSeconds,
        });
        return;
      }

      const activeBranches = await db
        .select()
        .from(branches)
        .where(and(eq(branches.code, branchCode), eq(branches.isActive, true)));

      const branch = activeBranches.find(
        (b) => b.name.trim().toLowerCase() === branchName.trim().toLowerCase()
      );

      if (!branch) {
        await writeAuditLog(db, {
          actorType: 'ANONYMOUS',
          actorRole: null,
          actorIdentifier: branchName,
          branchCode,
          action: 'LOGIN_BRANCH_FAILED',
          domain: 'auth',
          details: { reason: 'branch_not_found_or_mismatch' },
          ipAddress: ip,
        });
        res.status(401).json({ error: 'Invalid branch selection, branch code, or access code.' });
        return;
      }

      const [cred] = await db
        .select()
        .from(branchCredentials)
        .where(and(eq(branchCredentials.branchCode, branch.code), eq(branchCredentials.isActive, true)));

      if (!cred || accessCode === branch.code || !verifySecret(accessCode, cred.codeHash)) {
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
          details: { reason: cred ? 'invalid_access_code' : 'branch_credential_not_provisioned' },
          ipAddress: ip,
        });
        res.status(401).json({ error: 'Invalid branch selection, branch code, or access code.' });
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
