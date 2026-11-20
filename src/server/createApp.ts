import express, { type NextFunction, type Request, type Response } from 'express';
import type http from 'http';
import path from 'path';
import type { GoogleGenAI } from '@google/genai';
import { DatabaseUnavailableError, type AppDatabase } from '../db/index.ts';
import { csrfProtection, getAllowedOrigins } from './security/csrf.ts';
import { attachDatabase, type RequestDbHandle } from './middleware/auth.ts';
import { createAuthRouter } from './routes/authRoutes.ts';
import { createDashboardRouter } from './routes/dashboardRoutes.ts';
import { createScheduleRouter } from './routes/scheduleRoutes.ts';
import { createLocalMigrationRouter } from './routes/localMigrationRoutes.ts';
import { createAiRouter } from './routes/aiRoutes.ts';
import { createOperationalDomainsRouter } from './routes/operationalDomainsRoutes.ts';
import { createStaffAndWorkspaceRouter } from './routes/staffAndWorkspaceRoutes.ts';

export interface CreateAppOptions {
  getDb: () => AppDatabase;
  isDbConfigured: () => boolean;
  hasSupabaseRestOnly?: () => boolean;
  acquireRequestDb?: () => RequestDbHandle;
  getAiClient: () => GoogleGenAI | null;
  httpServer?: http.Server;
  distDir?: string;
  mountFrontend?: 'none' | 'vite' | 'static';
  mountDevFrontend?: (app: express.Express) => void;
}

export async function createApp(options: CreateAppOptions): Promise<express.Express> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));

  // Optional credentialed CORS for explicitly whitelisted split-origin frontends
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin.trim() : '';
    if (originHeader) {
      try {
        const normalized = new URL(originHeader).origin.toLowerCase();
        if (getAllowedOrigins().has(normalized)) {
          res.setHeader('Access-Control-Allow-Origin', originHeader);
          res.setHeader('Vary', 'Origin');
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Check');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
          res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
          if (req.method === 'OPTIONS') {
            res.status(204).end();
            return;
          }
        }
      } catch {
        // invalid Origin header ignored
      }
    }
    next();
  });

  // Public health endpoint (never blocks on DB outage so monitoring & UI detect DB state cleanly)
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    const databaseConfigured = options.isDbConfigured();
    res.json({
      status: 'ok',
      service: 'ASB Workforce Retail Operations Backend',
      databaseConfigured,
      supabaseRestOnly: !databaseConfigured && Boolean(options.hasSupabaseRestOnly?.()),
      geminiConfigured: Boolean(options.getAiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const databaseConfigured = options.isDbConfigured();
    res.json({
      status: 'ok',
      service: 'ASB Workforce Retail Operations Backend',
      databaseConfigured,
      supabaseRestOnly: !databaseConfigured && Boolean(options.hasSupabaseRestOnly?.()),
      geminiConfigured: Boolean(options.getAiClient()),
      timestamp: new Date().toISOString(),
    });
  });

  // Legacy unauthenticated AI endpoint permanently disabled
  app.post('/api/gemini/analyze', (_req: Request, res: Response) => {
    res.status(410).json({
      error: 'Legacy unauthenticated endpoint disabled. Use authenticated POST /api/v1/ai/diagnostics/analyze.',
    });
  });

  // Global CSRF + PostgreSQL availability guard for all v1 API endpoints (except health above)
  const v1 = express.Router();
  v1.use(csrfProtection);
  v1.use(attachDatabase(options.getDb, options.isDbConfigured, options.acquireRequestDb));

  v1.use('/auth', createAuthRouter());
  v1.use('/dashboard', createDashboardRouter());
  v1.use('/store-schedule', createScheduleRouter());
  v1.use('/migrations/local-import', createLocalMigrationRouter());
  v1.use('/ai/diagnostics', createAiRouter(options.getAiClient));
  v1.use('/', createOperationalDomainsRouter());
  v1.use('/', createStaffAndWorkspaceRouter());

  app.use('/api/v1', v1);

  // Unknown API routes always return JSON 404
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (options.mountFrontend === 'vite' && options.mountDevFrontend) {
    options.mountDevFrontend(app);
  } else if (options.mountFrontend === 'static' && options.distDir) {
    app.use(express.static(options.distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(options.distDir!, 'index.html'));
    });
  }

  // Global error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof DatabaseUnavailableError) {
      res.status(503).json({
        error: err.message,
        code: 'DATABASE_UNAVAILABLE',
        missingVariables: err.missingVariables,
      });
      return;
    }

    const extractCode = (value: unknown, depth = 0): string => {
      if (!value || typeof value !== 'object' || depth > 3) return '';
      const record = value as { code?: unknown; cause?: unknown };
      if (record.code !== undefined && record.code !== null && String(record.code).trim() !== '') {
        return String(record.code);
      }
      return extractCode(record.cause, depth + 1);
    };

    const pgCode = extractCode(err);
    if (pgCode === '23505') {
      res.status(409).json({ error: 'A duplicate record already exists.' });
      return;
    }
    if (pgCode === '23503' || pgCode === '23514') {
      res.status(400).json({ error: 'Record violates referential or validation constraints.' });
      return;
    }

    const dbUnavailableCodes = new Set([
      '28P01', // invalid_password
      '28000', // invalid_authorization_specification
      '3D000', // invalid_catalog_name
      '42P01', // undefined_table (schema/migrations not yet applied)
      '57P03', // cannot_connect_now
      '08001', // sqlclient_unable_to_establish_sqlconnection
      '08006', // connection_failure
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ENETUNREACH',
      'EHOSTUNREACH',
      'ECONNRESET',
      'ERR_INVALID_URL',
    ]);

    if (dbUnavailableCodes.has(pgCode)) {
      const detail =
        pgCode === '28P01' || pgCode === '28000'
          ? 'PostgreSQL authentication failed. Verify SQL_USER and SQL_PASSWORD.'
          : pgCode === '42P01'
            ? 'PostgreSQL schema is not initialized yet. Run database migrations first.'
            : 'PostgreSQL database is currently unreachable.';
      console.warn(`[ASB Workforce] Database error (${pgCode}): ${detail}`);
      res.status(503).json({
        error: detail,
        code: 'DATABASE_UNAVAILABLE',
        pgCode,
      });
      return;
    }

    const httpErr = err as {
      status?: unknown;
      statusCode?: unknown;
      type?: unknown;
      message?: unknown;
    };
    const rawStatus =
      typeof httpErr?.status === 'number'
        ? httpErr.status
        : typeof httpErr?.statusCode === 'number'
          ? httpErr.statusCode
          : 0;

    if (rawStatus >= 400 && rawStatus < 500) {
      res.status(rawStatus).json({
        error:
          typeof httpErr.message === 'string' && httpErr.message
            ? httpErr.message
            : `Request failed (${rawStatus}).`,
        ...(typeof httpErr.type === 'string' ? { code: httpErr.type } : {}),
      });
      return;
    }

    console.error('Unhandled backend error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
