import http from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { env as workerEnv } from 'cloudflare:workers';
import { GoogleGenAI } from '@google/genai';
import {
  createRequestScopedDb,
  detectSupabaseRestOnlyConfig,
  getDb,
  isDatabaseConfigured,
  type EnvLike,
} from './db/index.ts';
import { createApp } from './server/createApp.ts';

const WORKER_ENV_KEYS = [
  'SQL_HOST',
  'SQL_PORT',
  'SQL_DB_NAME',
  'SQL_USER',
  'SQL_PASSWORD',
  'SQL_SSL',
  'SQL_SSL_CA',
  'DATABASE_URL',
  'POSTGRES_URL',
  'SUPABASE_DB_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'GEMINI_API_KEY',
  'ALLOWED_ORIGINS',
  'APP_URL',
] as const;

function readWorkerEnv(): EnvLike {
  const merged: EnvLike = {};
  for (const key of WORKER_ENV_KEYS) {
    const boundVal = workerEnv[key];
    if (typeof boundVal === 'string' && boundVal.trim() !== '') {
      merged[key] = boundVal;
      process.env[key] = boundVal;
    } else if (typeof process.env[key] === 'string' && process.env[key]!.trim() !== '') {
      merged[key] = process.env[key];
    }
  }

  if (
    workerEnv.HYPERDRIVE &&
    typeof workerEnv.HYPERDRIVE.connectionString === 'string' &&
    workerEnv.HYPERDRIVE.connectionString.trim() !== ''
  ) {
    merged.DATABASE_URL = workerEnv.HYPERDRIVE.connectionString;
    if (!merged.SQL_SSL) {
      merged.SQL_SSL = 'false';
    }
  }

  return merged;
}

function buildWorkerAiClient(): GoogleGenAI | null {
  const env = readWorkerEnv();
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const WORKER_PORT = 8080;

const appPromise = createApp({
  getDb,
  isDbConfigured: () => isDatabaseConfigured(readWorkerEnv()),
  hasSupabaseRestOnly: () => {
    const env = readWorkerEnv();
    return !isDatabaseConfigured(env) && detectSupabaseRestOnlyConfig(env);
  },
  acquireRequestDb: () => createRequestScopedDb(readWorkerEnv()),
  getAiClient: buildWorkerAiClient,
  mountFrontend: 'none',
});

const server = http.createServer((req, res) => {
  readWorkerEnv();
  appPromise
    .then((app) => {
      app(req, res);
    })
    .catch((err) => {
      console.error('[ASB Workforce Worker] App initialization error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Worker application failed to initialize.' }));
      }
    });
});

server.listen(WORKER_PORT);

export default httpServerHandler({ port: WORKER_PORT });
