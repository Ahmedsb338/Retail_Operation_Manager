import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApp } from '../createApp.ts';
import {
  createRequestScopedDb,
  DatabaseUnavailableError,
  detectSupabaseRestOnlyConfig,
  getMissingDatabaseEnvVars,
  isDatabaseConfigured,
  isValidPostgresConnectionString,
  resolveConnectionString,
  resolvePgSslConfig,
} from '../../db/index.ts';
import iconvShim, {
  decode,
  encode,
  encodingExists,
  getDecoder,
  getEncoder,
  supportsStreams,
} from '../../worker-shims/iconv-lite.ts';

async function withServer(
  appPromise: ReturnType<typeof createApp>,
  fn: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = await appPromise;
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${addr.port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

describe('Cloudflare Worker Compatibility — iconv-lite Shim, Wrangler Config, Health & PostgreSQL Config', () => {
  it('supports UTF-8, UTF-16LE, UTF-16BE, ASCII, and Latin-1 and rejects unsupported encodings without silent UTF-8 fallback', () => {
    assert.equal(supportsStreams, false);
    assert.equal(typeof iconvShim.encodingExists, 'function');
    assert.equal(typeof iconvShim.decode, 'function');
    assert.equal(typeof iconvShim.encode, 'function');
    assert.equal(typeof iconvShim.getDecoder, 'function');
    assert.equal(typeof iconvShim.getEncoder, 'function');

    // UTF-8 round-trip + streaming split multi-byte Arabic character
    const sampleAr = '{"branch":"أبو المطامير"}';
    const utf8Buf = encode(sampleAr, 'utf-8');
    assert.equal(decode(utf8Buf, 'utf8'), sampleAr);
    const utf8Decoder = getDecoder('utf-8');
    const mid = Math.floor(utf8Buf.length / 2);
    const streamed = utf8Decoder.write(utf8Buf.subarray(0, mid)) + utf8Decoder.write(utf8Buf.subarray(mid)) + utf8Decoder.end();
    assert.equal(streamed, sampleAr);

    // UTF-16LE & UTF-16BE round-trips + BOM stripping
    const utf16leBuf = encode('ASB-1750-ا', 'utf-16le', { addBOM: true });
    assert.equal(decode(utf16leBuf, 'utf16le'), 'ASB-1750-ا');
    const utf16beBuf = encode('ASB-1750-ا', 'utf-16be', { addBOM: true });
    assert.equal(utf16beBuf[0], 0xfe);
    assert.equal(utf16beBuf[1], 0xff);
    assert.equal(decode(utf16beBuf, 'utf-16be'), 'ASB-1750-ا');
    const utf16beDecoder = getDecoder('utf-16be');
    assert.equal(
      utf16beDecoder.write(utf16beBuf.subarray(0, 3)) + utf16beDecoder.write(utf16beBuf.subarray(3)) + utf16beDecoder.end(),
      'ASB-1750-ا'
    );

    // ASCII: <0x80 preserved, >=0x80 replaced with U+FFFD (not decoded as UTF-8 or Latin-1)
    assert.equal(decode(Buffer.from([0x41, 0x80, 0x42]), 'ascii'), 'A\uFFFDB');
    assert.deepEqual(encode('AéB', 'ascii'), Buffer.from([0x41, 0x3f, 0x42]));

    // Latin-1 / Windows-1252 parity
    assert.equal(decode(Buffer.from([0x41, 0x80, 0xe9]), 'latin1'), 'A€é');
    assert.deepEqual(encode('A€é', 'iso-8859-1'), Buffer.from([0x41, 0x80, 0xe9]));

    // Unsupported encodings MUST return false and throw /^Encoding not recognized: /
    for (const bad of ['', '   ', 'utf-99', 'ebcdic-cp-us', 'x-unknown-charset']) {
      assert.equal(encodingExists(bad), false, `expected encodingExists(${JSON.stringify(bad)}) to be false`);
      assert.throws(() => decode(Buffer.from('hello'), bad), /^Error: Encoding not recognized: /);
      assert.throws(() => encode('hello', bad), /^Error: Encoding not recognized: /);
      assert.throws(() => getDecoder(bad), /^Error: Encoding not recognized: /);
      assert.throws(() => getEncoder(bad), /^Error: Encoding not recognized: /);
    }
  });

  it('preserves HTTP 415 unsupported charset behavior in Express JSON body parsing and never falls back to 500 or UTF-8', async () => {
    const appPromise = createApp({
      getDb: () => {
        throw new DatabaseUnavailableError(['SQL_HOST']);
      },
      isDbConfigured: () => false,
      getAiClient: () => null,
      mountFrontend: 'none',
    });

    await withServer(appPromise, async (baseUrl) => {
      // Non-utf charset rejected by body-parser with 415
      const resIso5 = await fetch(`${baseUrl}/api/v1/auth/login-area`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=iso-8859-5',
          'x-csrf-check': '1',
        },
        body: JSON.stringify({ username: 'area', password: 'secret' }),
      });
      assert.equal(resIso5.status, 415);

      // utf-99 passes body-parser's `utf-` prefix check and hits raw-body -> iconv.getDecoder('utf-99') -> 415
      const resUtf99 = await fetch(`${baseUrl}/api/v1/auth/login-area`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json; charset=utf-99',
          'x-csrf-check': '1',
        },
        body: JSON.stringify({ username: 'area', password: 'secret' }),
      });
      assert.equal(resUtf99.status, 415);
    });
  });

  it('reports accurate health status and separates SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY from PostgreSQL credentials', async () => {
    const restOnlyEnv = {
      SUPABASE_URL: 'https://example-project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_only',
    };
    assert.equal(isDatabaseConfigured(restOnlyEnv), false);
    assert.equal(detectSupabaseRestOnlyConfig(restOnlyEnv), true);
    assert.deepEqual(getMissingDatabaseEnvVars(restOnlyEnv), [
      'SQL_HOST',
      'SQL_DB_NAME',
      'SQL_USER',
      'SQL_PASSWORD',
    ]);

    const appPromise = createApp({
      getDb: () => {
        throw new DatabaseUnavailableError(getMissingDatabaseEnvVars(restOnlyEnv));
      },
      isDbConfigured: () => isDatabaseConfigured(restOnlyEnv),
      hasSupabaseRestOnly: () => !isDatabaseConfigured(restOnlyEnv) && detectSupabaseRestOnlyConfig(restOnlyEnv),
      getAiClient: () => null,
      mountFrontend: 'none',
    });

    await withServer(appPromise, async (baseUrl) => {
      const h1 = await fetch(`${baseUrl}/api/v1/health`);
      assert.equal(h1.status, 200);
      const b1 = (await h1.json()) as Record<string, unknown>;
      assert.equal(b1.status, 'ok');
      assert.equal(b1.databaseConfigured, false);
      assert.equal(b1.supabaseRestOnly, true);

      const h2 = await fetch(`${baseUrl}/api/health`);
      assert.equal(h2.status, 200);
      const b2 = (await h2.json()) as Record<string, unknown>;
      assert.equal(b2.databaseConfigured, false);
      assert.equal(b2.supabaseRestOnly, true);

      const branchesRes = await fetch(`${baseUrl}/api/v1/auth/branches`);
      assert.equal(branchesRes.status, 503);
      const branchesBody = (await branchesRes.json()) as Record<string, unknown>;
      assert.equal(branchesBody.code, 'DATABASE_UNAVAILABLE');
    });
  });

  it('validates DATABASE_URL, Session Pooler port 5432, SSL config, and rejects invalid DB configuration with 503', async () => {
    const poolerUrl = 'postgresql://postgres.myref:secret@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';
    assert.equal(resolveConnectionString({ DATABASE_URL: poolerUrl }), poolerUrl);
    assert.equal(isValidPostgresConnectionString(poolerUrl), true);
    assert.equal(isDatabaseConfigured({ DATABASE_URL: poolerUrl }), true);
    assert.deepEqual(resolvePgSslConfig({ DATABASE_URL: poolerUrl }), { rejectUnauthorized: false });

    const sessionPoolerVars = {
      SQL_HOST: 'aws-1-eu-west-1.pooler.supabase.com',
      SQL_PORT: '5432',
      SQL_DB_NAME: 'postgres',
      SQL_USER: 'postgres.myref',
      SQL_PASSWORD: 'secret',
      SQL_SSL: 'true',
    };
    assert.equal(isDatabaseConfigured(sessionPoolerVars), true);
    assert.deepEqual(resolvePgSslConfig(sessionPoolerVars), { rejectUnauthorized: false });

    // Invalid DATABASE_URL values (e.g. REST URL or malformed text) must not be treated as valid
    assert.equal(isDatabaseConfigured({ DATABASE_URL: 'https://example.supabase.co' }), false);
    assert.equal(isDatabaseConfigured({ DATABASE_URL: 'not-a-postgres-uri' }), false);
    assert.throws(
      () => createRequestScopedDb({ DATABASE_URL: 'https://example.supabase.co' }),
      (err: unknown) => err instanceof DatabaseUnavailableError && err.statusCode === 503
    );

    // Unreachable PostgreSQL port yields clean 503 DATABASE_UNAVAILABLE
    const unreachableEnv = { DATABASE_URL: 'postgresql://postgres:bad@127.0.0.1:1/postgres' };
    const appPromise = createApp({
      getDb: () => {
        throw new Error('use acquireRequestDb');
      },
      isDbConfigured: () => isDatabaseConfigured(unreachableEnv),
      acquireRequestDb: () => createRequestScopedDb(unreachableEnv),
      getAiClient: () => null,
      mountFrontend: 'none',
    });

    await withServer(appPromise, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/branches`);
      assert.equal(res.status, 503);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.code, 'DATABASE_UNAVAILABLE');
    });
  });

  it('verifies wrangler.jsonc enforces retail-operation-manager, nodejs_compat, iconv-lite alias, and /api/* routing', () => {
    const raw = fs.readFileSync(path.resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    const parsed = JSON.parse(raw) as {
      name?: string;
      main?: string;
      compatibility_flags?: string[];
      alias?: Record<string, string>;
      assets?: {
        directory?: string;
        not_found_handling?: string;
        run_worker_first?: string[];
      };
    };

    assert.equal(parsed.name, 'retail-operation-manager');
    assert.equal(parsed.main, 'src/worker.ts');
    assert.ok(parsed.compatibility_flags?.includes('nodejs_compat'));
    assert.equal(parsed.alias?.['iconv-lite'], './src/worker-shims/iconv-lite.ts');
    assert.equal(parsed.assets?.directory, './dist');
    assert.equal(parsed.assets?.not_found_handling, 'single-page-application');
    assert.ok(parsed.assets?.run_worker_first?.includes('/api/*'));
  });
});
