import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  ApiError,
  createApiInstance,
  normalizeAxiosError,
  resolveSafeApiBaseUrl,
  resolveSafeApiUrl,
} from '../api.ts';

describe('Axios API Service (src/services/api.ts)', () => {
  it('safely parses and normalizes VITE_API_BASE_URL without throwing on invalid or unsafe values', () => {
    assert.equal(resolveSafeApiBaseUrl(undefined), '');
    assert.equal(resolveSafeApiBaseUrl('   '), '');
    assert.equal(resolveSafeApiBaseUrl('https://api.example.com/'), 'https://api.example.com');
    assert.equal(resolveSafeApiBaseUrl('https://api.example.com/v1///'), 'https://api.example.com/v1');
    assert.equal(resolveSafeApiBaseUrl('http://localhost:3000/'), 'http://localhost:3000');
    assert.equal(resolveSafeApiBaseUrl('/proxy/'), '/proxy');

    // Invalid or unsafe protocols safely fall back to empty string
    assert.equal(resolveSafeApiBaseUrl('javascript:alert(1)'), '');
    assert.equal(resolveSafeApiBaseUrl('ftp://files.example.com'), '');
    assert.equal(resolveSafeApiBaseUrl('not a valid url'), '');

    assert.equal(resolveSafeApiUrl('/api/v1/health', 'https://api.example.com/'), 'https://api.example.com/api/v1/health');
    assert.equal(resolveSafeApiUrl('api/v1/health', ''), '/api/v1/health');
  });

  it('injects X-CSRF-Check on mutating requests, preserves credentials, and normalizes unreachable backend errors', async () => {
    const mockHeaders = new AxiosHeaders();
    const networkErr = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED', {
      headers: mockHeaders,
      url: '/api/v1/health',
    });
    const normalizedNet = normalizeAxiosError(networkErr);
    assert.ok(normalizedNet instanceof ApiError);
    assert.equal(normalizedNet.status, 503);
    assert.equal(normalizedNet.code, 'BACKEND_UNAVAILABLE');

    const timeoutErr = new AxiosError('timeout of 8000ms exceeded', 'ECONNABORTED', {
      headers: mockHeaders,
      url: '/api/v1/health',
    });
    const normalizedTimeout = normalizeAxiosError(timeoutErr);
    assert.equal(normalizedTimeout.status, 503);
    assert.equal(normalizedTimeout.code, 'BACKEND_UNAVAILABLE');
    assert.match(normalizedTimeout.message, /timed out/i);

    const static405Err = new AxiosError('Method Not Allowed', 'ERR_BAD_REQUEST', { headers: mockHeaders }, undefined, {
      status: 405,
      statusText: 'Method Not Allowed',
      headers: { 'content-type': 'text/html' },
      config: { headers: mockHeaders },
      data: '<html>405</html>',
    });
    const normalized405 = normalizeAxiosError(static405Err);
    assert.equal(normalized405.status, 405);
    assert.equal(normalized405.code, 'BACKEND_UNAVAILABLE');

    // Live HTTP round-trip check against a local server
    let seenCsrf = '';
    const server = http.createServer((req, res) => {
      if (req.url === '/api/v1/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', databaseConfigured: true }));
        return;
      }
      if (req.url === '/api/v1/echo' && req.method === 'POST') {
        seenCsrf = String(req.headers['x-csrf-check'] || '');
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (req.url === '/api/v1/html-fallback') {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end('<!doctype html><html></html>');
        return;
      }
      res.writeHead(503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'DB down', code: 'DATABASE_UNAVAILABLE', missingVariables: ['SQL_HOST'] }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    const client = createApiInstance(`http://127.0.0.1:${addr.port}`);
    try {
      const healthRes = await client.get('/api/v1/health');
      assert.equal(healthRes.data.status, 'ok');

      const postRes = await client.post('/api/v1/echo', { ping: 1 });
      assert.equal(postRes.data.ok, true);
      assert.equal(seenCsrf, '1');

      await assert.rejects(
        () => client.get('/api/v1/html-fallback'),
        (err: unknown) => err instanceof ApiError && err.status === 503 && err.code === 'BACKEND_UNAVAILABLE'
      );

      await assert.rejects(
        () => client.get('/api/v1/db-error'),
        (err: unknown) =>
          err instanceof ApiError &&
          err.status === 503 &&
          err.code === 'DATABASE_UNAVAILABLE' &&
          err.missingVariables?.[0] === 'SQL_HOST'
      );
    } finally {
      await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  });
});
