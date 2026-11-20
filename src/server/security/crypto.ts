import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

export const SESSION_COOKIE_NAME = 'asb_session';
export const SESSION_TTL_SECONDS = 21600; // 6 hours

export function hashSecret(plain: string): string {
  const value = String(plain);
  if (!value) {
    throw new Error('Cannot hash an empty secret.');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(value, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  if (!plain || !storedHash || !storedHash.startsWith('scrypt$')) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const actualBuf = crypto.scryptSync(String(plain), salt, expectedBuf.length, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(String(rawToken), 'utf8').digest('hex');
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = decodeURIComponent(part.slice(0, eqIndex).trim());
    const val = decodeURIComponent(part.slice(eqIndex + 1).trim());
    if (key) result[key] = val;
  }
  return result;
}

export function buildSessionCookie(
  rawToken: string,
  options: { secure: boolean; maxAgeSeconds?: number }
): string {
  const maxAge = options.maxAgeSeconds ?? SESSION_TTL_SECONDS;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    'HttpOnly',
    options.secure ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (options.secure) {
    parts.push('Secure', 'Partitioned');
  }
  return parts.join('; ');
}

export function buildClearSessionCookie(options: { secure: boolean }): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    options.secure ? 'SameSite=None' : 'SameSite=Lax',
    'Max-Age=0',
  ];
  if (options.secure) {
    parts.push('Secure', 'Partitioned');
  }
  return parts.join('; ');
}
