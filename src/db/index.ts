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

export function getMissingDatabaseEnvVars(env: NodeJS.ProcessEnv = process.env): string[] {
  const required = ['SQL_HOST', 'SQL_DB_NAME', 'SQL_USER', 'SQL_PASSWORD'] as const;
  return required.filter((key) => !env[key] || String(env[key]).trim() === '');
}

export function isDatabaseConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return getMissingDatabaseEnvVars(env).length === 0;
}

export function resolvePgSslConfig(
  env: NodeJS.ProcessEnv = process.env
): false | { rejectUnauthorized: boolean; ca?: string } {
  const rawSsl = String(env.SQL_SSL || '').trim().toLowerCase();
  const host = String(env.SQL_HOST || '').trim().toLowerCase();
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

declare global {
  var _postgresPool: Pool | undefined;
}

export function getPostgresPool(): Pool {
  const missing = getMissingDatabaseEnvVars();
  if (missing.length > 0) {
    throw new DatabaseUnavailableError(missing);
  }

  if (!global._postgresPool) {
    const port = process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432;
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      port: Number.isFinite(port) && port > 0 ? port : 5432,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      ssl: resolvePgSslConfig(),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });

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
