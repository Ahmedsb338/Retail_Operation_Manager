import type { NextFunction, Request, Response } from 'express';
import { DatabaseUnavailableError, type AppDatabase } from '../../db/index.ts';
import { parseCookies, SESSION_COOKIE_NAME } from '../security/crypto.ts';
import {
  DatabaseSessionStore,
  type AuthenticatedPrincipal,
  type AuthorizedBranchSummary,
} from '../security/sessions.ts';

export interface AppRequest extends Request {
  db?: AppDatabase;
  principal?: AuthenticatedPrincipal;
  sessionToken?: string;
}

export function attachDatabase(
  getDatabase: () => AppDatabase,
  isConfigured: () => boolean
) {
  return (req: AppRequest, res: Response, next: NextFunction): void => {
    if (!isConfigured()) {
      res.status(503).json({
        error: 'Database is unavailable. Configure PostgreSQL environment variables (SQL_HOST, SQL_DB_NAME, SQL_USER, SQL_PASSWORD).',
        code: 'DATABASE_UNAVAILABLE',
      });
      return;
    }

    try {
      req.db = getDatabase();
      next();
    } catch (err) {
      if (err instanceof DatabaseUnavailableError) {
        res.status(503).json({
          error: err.message,
          code: 'DATABASE_UNAVAILABLE',
          missingVariables: err.missingVariables,
        });
        return;
      }
      next(err);
    }
  };
}

export async function requireAuth(
  req: AppRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.db) {
    res.status(503).json({ error: 'Database is unavailable.', code: 'DATABASE_UNAVAILABLE' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME] || '';
  if (!rawToken) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  try {
    const store = new DatabaseSessionStore(req.db);
    const principal = await store.validateSessionToken(rawToken);
    if (!principal) {
      res.status(401).json({ error: 'Session expired or revoked. Please sign in again.' });
      return;
    }

    req.principal = principal;
    req.sessionToken = rawToken;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireStoreManager(
  req: AppRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.principal) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.principal.role !== 'STORE_MANAGER' || !req.principal.branchCode) {
    res.status(403).json({
      error: 'Read-only access. Store Manager permission is required for modifications.',
    });
    return;
  }
  next();
}

export function resolveScopedBranches(
  principal: AuthenticatedPrincipal,
  requestedBranchCode?: string | null
): { branches: AuthorizedBranchSummary[]; error?: string } {
  const cleanRequested = String(requestedBranchCode || '').trim();

  if (principal.role === 'STORE_MANAGER') {
    if (!principal.branchCode) {
      return { branches: [], error: 'Missing Store Manager branch binding.' };
    }
    if (cleanRequested && cleanRequested !== principal.branchCode) {
      return { branches: [], error: 'Cross-branch access is denied.' };
    }
    return { branches: principal.authorizedBranches };
  }

  // AREA_MANAGER explicit assignments only
  if (principal.authorizedBranches.length === 0) {
    return {
      branches: [],
      error: cleanRequested
        ? 'Selected branch is outside your assigned scope.'
        : undefined,
    };
  }

  if (!cleanRequested) {
    return { branches: principal.authorizedBranches };
  }

  const matched = principal.authorizedBranches.filter((b) => b.code === cleanRequested);
  if (matched.length === 0) {
    return { branches: [], error: 'Selected branch is outside your assigned scope.' };
  }

  return { branches: matched };
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}
