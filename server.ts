import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { getDb, isDatabaseConfigured } from './src/db/index.ts';
import { createApp } from './src/server/createApp.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readCliArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  return eqArg ? eqArg.slice(flag.length + 1) : undefined;
}

const rawPort = readCliArg('--port') ?? process.env.PORT;
const PORT = rawPort ? parseInt(rawPort, 10) : 3000;
const HOST = readCliArg('--host') ?? process.env.HOST ?? '0.0.0.0';

function buildAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
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

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const aiClient = buildAiClient();
  const httpServer = http.createServer();

  const app = await createApp({
    getDb,
    isDbConfigured: () => isDatabaseConfigured(),
    getAiClient: () => aiClient,
    httpServer,
    distDir: path.resolve(__dirname, 'dist'),
    mountFrontend: isProduction ? 'static' : 'vite',
    mountDevFrontend: isProduction
      ? undefined
      : (expressApp) => {
          const isHmrDisabled = process.env.DISABLE_HMR === 'true';
          const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
            createViteServer({
              server: {
                middlewareMode: true,
                hmr: !isHmrDisabled,
                ws: isHmrDisabled ? false : { server: httpServer },
              },
              appType: 'spa',
            })
          );
          vitePromise.catch((err) => {
            console.error('[ASB Workforce] Vite middleware failed to initialize:', err);
          });
          if (isHmrDisabled) {
            expressApp.get('/@vite/client', (req, res, next) => {
              vitePromise
                .then(async (vite) => {
                  const transformed = await vite.transformRequest('/@vite/client');
                  if (!transformed?.code) {
                    vite.middlewares(req, res, next);
                    return;
                  }
                  const patched = transformed.code
                    .replace(
                      'transport.connect(createHMRHandler(handleMessage));',
                      '/* WebSocket disabled when DISABLE_HMR=true */'
                    )
                    .replace(
                      'setupForwardConsoleHandler(transport, forwardConsole);',
                      '/* Console forwarding disabled when DISABLE_HMR=true */'
                    );
                  res.status(200);
                  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.end(patched);
                })
                .catch(next);
            });
          }
          expressApp.use((req, res, next) => {
            vitePromise.then((vite) => vite.middlewares(req, res, next)).catch(next);
          });
        },
  });

  httpServer.on('request', app);

  httpServer.listen(PORT, HOST, () => {
    console.log(
      `[ASB Workforce] Server listening on http://${HOST}:${PORT} (dbConfigured=${isDatabaseConfigured()}, aiConfigured=${Boolean(aiClient)})`
    );
  });
}

startServer().catch((err) => {
  console.error('[ASB Workforce] Fatal startup error:', err);
  process.exit(1);
});
