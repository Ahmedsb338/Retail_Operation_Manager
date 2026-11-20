import type { NextFunction, Request, Response } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function extractOrigin(urlValue: string | undefined): string | null {
  if (!urlValue) return null;
  try {
    const parsed = new URL(urlValue);
    return parsed.origin.toLowerCase();
  } catch {
    return null;
  }
}

export function getAllowedOrigins(): Set<string> {
  const result = new Set<string>();
  const raw = String(process.env.ALLOWED_ORIGINS || '');
  for (const item of raw.split(',')) {
    const origin = extractOrigin(item.trim());
    if (origin) result.add(origin);
  }
  return result;
}

/**
 * Enforces same-origin / explicit-header CSRF protection for all mutating API
 * endpoints under /api/*. Because cookies use HttpOnly + SameSite=Lax, any
 * cross-site POST/PUT/PATCH/DELETE is blocked when Origin or Referer mismatches
 * the host or when browser metadata headers indicate a cross-site request
 * (unless the origin is explicitly whitelisted via ALLOWED_ORIGINS).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const configuredOrigins = getAllowedOrigins();
  const origin = extractOrigin(req.headers.origin as string | undefined);
  const refererOrigin = extractOrigin(req.headers.referer as string | undefined);
  const isExplicitlyAllowedCrossOrigin = Boolean(
    origin && configuredOrigins.has(origin) && req.headers['x-csrf-check'] === '1'
  );

  const secFetchSite = String(req.headers['sec-fetch-site'] || '').toLowerCase();
  if (
    secFetchSite &&
    secFetchSite !== 'same-origin' &&
    secFetchSite !== 'none' &&
    !isExplicitlyAllowedCrossOrigin
  ) {
    res.status(403).json({ error: 'Cross-site request blocked by CSRF policy.' });
    return;
  }

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim().toLowerCase();
  const protoHeader = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();

  const expectedOrigins = new Set<string>(configuredOrigins);
  if (host) {
    expectedOrigins.add(`${protoHeader}://${host}`);
    expectedOrigins.add(`http://${host}`);
    expectedOrigins.add(`https://${host}`);
  }
  if (process.env.APP_URL) {
    const configured = extractOrigin(process.env.APP_URL);
    if (configured) expectedOrigins.add(configured);
  }

  if (origin) {
    if (!expectedOrigins.has(origin)) {
      res.status(403).json({ error: 'Invalid request origin blocked by CSRF policy.' });
      return;
    }
    next();
    return;
  }

  if (refererOrigin) {
    if (!expectedOrigins.has(refererOrigin)) {
      res.status(403).json({ error: 'Invalid referer origin blocked by CSRF policy.' });
      return;
    }
    next();
    return;
  }

  // Non-browser API test clients without Origin/Referer must include X-CSRF-Check: 1
  if (req.headers['x-csrf-check'] === '1') {
    next();
    return;
  }

  res.status(403).json({ error: 'Missing Origin or CSRF verification header.' });
}
