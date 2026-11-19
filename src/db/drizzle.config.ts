import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const isGenerateCommand = process.argv.includes('generate');

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const adminUser = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const adminPassword = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;
const isSupabaseHost = Boolean(
  sqlHost && (sqlHost.toLowerCase().endsWith('.supabase.co') || sqlHost.toLowerCase().endsWith('.supabase.com'))
);
const useSsl =
  process.env.SQL_SSL !== 'false' &&
  (process.env.SQL_SSL === 'true' || process.env.SQL_SSL === 'require' || isSupabaseHost);

if (!isGenerateCommand && (!sqlHost || !sqlDbName || !adminUser || !adminPassword)) {
  throw new Error(
    'Live Drizzle Kit database commands require SQL_HOST, SQL_DB_NAME, SQL_USER (or SQL_ADMIN_USER), and SQL_PASSWORD (or SQL_ADMIN_PASSWORD).'
  );
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  ...(sqlHost && sqlDbName && adminUser && adminPassword
    ? {
        dbCredentials: {
          host: sqlHost,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
          user: adminUser,
          password: adminPassword,
          database: sqlDbName,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
        },
      }
    : {}),
  verbose: true,
});
