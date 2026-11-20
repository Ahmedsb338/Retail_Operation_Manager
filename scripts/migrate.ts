import * as dotenv from 'dotenv';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPostgresPool, isDatabaseConfigured } from '../src/db/index.ts';

dotenv.config();

async function main(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.error(
      'Database configuration missing. Set SQL_HOST, SQL_DB_NAME, SQL_USER, and SQL_PASSWORD in .env or environment variables.'
    );
    process.exit(1);
  }

  const db = getDb();
  const pool = getPostgresPool();
  try {
    console.log('Applying Drizzle SQL migrations from ./drizzle ...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('All PostgreSQL migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const cause =
    err && typeof err === 'object' && 'cause' in err ? (err as { cause?: { message?: string } }).cause : undefined;
  console.error(
    'Migration failed:',
    err instanceof Error ? err.message : err,
    cause?.message ? `(${cause.message})` : ''
  );
  process.exit(1);
});
