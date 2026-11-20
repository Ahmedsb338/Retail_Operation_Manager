import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export type AppDatabase = NodePgDatabase<typeof schema>;

export class DatabaseUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly missingVariables: string[];

  constructor(missingVariables: string[]) {
    super(
      missingVariables.length > 0
        ? `PostgreSQL database configuration is missing: ${missingVariables.join(', ')}. Configure SQL_HOST, SQL_DB_NAME, SQL_USER, and SQL_PASSWORD before starting database-backed operations.`
        : 'PostgreSQL database is unavailable.'
    );
    this.name = 'DatabaseUnavailableError';
    this.missingVariables = missingVariables;
  }
}

export interface EnvLike {
  [key: string]: string | undefined;
}

export function getMissingDatabaseEnvVars(env: EnvLike = process.env): string[] {
  if (env.DATABASE_URL && String(env.DATABASE_URL).trim() !== '') {
    return [];
  }
  const required = ['SQL_HOST', 'SQL_DB_NAME', 'SQL_USER', 'SQL_PASSWORD'] as const;
  return required.filter((key) => !env[key] || String(env[key]).trim() === '');
}

export function isDatabaseConfigured(env: EnvLike = process.env): boolean {
  return getMissingDatabaseEnvVars(env).length === 0;
}

export function resolvePgSslConfig(
  env: EnvLike = process.env
): false | { rejectUnauthorized: boolean; ca?: string } {
  const rawSsl = String(env.SQL_SSL || '').trim().toLowerCase();
  let host = String(env.SQL_HOST || '').trim().toLowerCase();
  if (!host && env.DATABASE_URL) {
    try {
      host = new URL(String(env.DATABASE_URL)).hostname.toLowerCase();
    } catch {
      // ignore invalid URL
    }
  }
  const isSupabaseHost =
    host.endsWith('.supabase.co') || host.endsWith('.supabase.com');

  if (rawSsl === 'false' || rawSsl === '0' || rawSsl === 'disable') {
    return false;
  }

  const sslCa = String(env.SQL_SSL_CA || '').trim();
  if (sslCa) {
    return {
      rejectUnauthorized: true,
      ca: sslCa.replace(/\\n/g, '\n'),
    };
  }

  if (rawSsl === 'strict') {
    return { rejectUnauthorized: true };
  }

  if (
    rawSsl === 'true' ||
    rawSsl === '1' ||
    rawSsl === 'require' ||
    rawSsl === 'no-verify' ||
    isSupabaseHost
  ) {
    return { rejectUnauthorized: false };
  }

  return false;
}

function buildPoolConfig(env: EnvLike, maxConnections: number) {
  const ssl = resolvePgSslConfig(env);
  if (env.DATABASE_URL && String(env.DATABASE_URL).trim() !== '') {
    return {
      connectionString: String(env.DATABASE_URL).trim(),
      ...(ssl ? { ssl } : {}),
      max: maxConnections,
      idleTimeoutMillis: maxConnections === 1 ? 5000 : 30000,
      connectionTimeoutMillis: 15000,
    };
  }

  const port = env.SQL_PORT ? Number(env.SQL_PORT) : 5432;
  return {
    host: env.SQL_HOST,
    port: Number.isFinite(port) && port > 0 ? port : 5432,
    user: env.SQL_USER,
    password: env.SQL_PASSWORD,
    database: env.SQL_DB_NAME,
    ssl,
    max: maxConnections,
    idleTimeoutMillis: maxConnections === 1 ? 5000 : 30000,
    connectionTimeoutMillis: 15000,
  };
}

declare global {
  var _postgresPool: Pool | undefined;
}

export function getPostgresPool(): Pool {
  const missing = getMissingDatabaseEnvVars();
  if (missing.length > 0) {
    throw new DatabaseUnavailableError(missing);
  }

  if (!global._postgresPool) {
    global._postgresPool = new Pool(buildPoolConfig(process.env, 10));

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected PostgreSQL idle pool client error:', err);
    });
  }

  return global._postgresPool;
}

export function getDb(): AppDatabase {
  const pool = getPostgresPool();
  return drizzle(pool, { schema });
}

export function createRequestScopedDb(env: EnvLike): {
  db: AppDatabase;
  close: () => Promise<void>;
} {
  const missing = getMissingDatabaseEnvVars(env);
  if (missing.length > 0) {
    throw new DatabaseUnavailableError(missing);
  }

  const pool = new Pool(buildPoolConfig(env, 1));
  pool.on('error', (err) => {
    console.error('Unexpected request-scoped PostgreSQL pool error:', err);
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    close: async () => {
      try {
        await pool.end();
      } catch {
        // ignore close errors on already-ended pool
      }
    },
  };
}
