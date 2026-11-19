import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../schema.ts';
import type { AppDatabase } from '../index.ts';

export interface TestDbContext {
  client: PGlite;
  db: AppDatabase;
  close: () => Promise<void>;
}

/**
 * Creates an isolated in-memory PGlite instance strictly for automated tests
 * and applies the real versioned SQL migrations from ./drizzle.
 * Never imported or used in production runtime code.
 */
export async function createMigratedTestDb(): Promise<TestDbContext> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  const migrationsFolder = path.resolve(process.cwd(), 'drizzle');
  await migrate(pgliteDb, { migrationsFolder });

  return {
    client,
    db: pgliteDb as unknown as AppDatabase,
    close: async () => {
      await client.close();
    },
  };
}
