import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h
/** Bump to invalidate all previously issued (including forged) sessions. */
const TOKEN_VERSION = 3;

let warnedWeakSecret = false;

/**
 * Prefer a dedicated SESSION_TOKEN_SECRET. Never fall back to public SITE_URL.
 * In production, refuse to use the Supabase service key as HMAC material.
 */
function getSecret() {
  const dedicated = String(process.env.SESSION_TOKEN_SECRET || '').trim();
  if (dedicated.length >= 32) return dedicated;

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const fromEnv = String(
      process.env.SUPABASE_SECRET_KEY
      || process.env.SUPABASE_SERVICE_ROLE_KEY
      || '',
    ).trim();
    if (fromEnv.length >= 24) return fromEnv;
  }

  if (!warnedWeakSecret) {
    warnedWeakSecret = true;
    console.error(
      '[security] SESSION_TOKEN_SECRET missing or too short — using ephemeral secret. Set a long SESSION_TOKEN_SECRET in Render (forces re-login).',
    );
  }

  if (!globalThis.__bloxSessionSecret) {
    globalThis.__bloxSessionSecret = randomBytes(32).toString('hex');
  }
  return globalThis.__bloxSessionSecret;
}

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

function fromB64url(input) {
  return Buffer.from(String(input), 'base64url').toString('utf8');
}

function sign(payloadPart) {
  return createHmac('sha256', getSecret()).update(payloadPart).digest('base64url');
}

export function createSessionToken({ userId, email }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const id = String(userId || '').trim();
  if (!normalizedEmail || !id) return null;
  const body = {
    v: TOKEN_VERSION,
    userId: id,
    email: normalizedEmail,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const payloadPart = b64url(JSON.stringify(body));
  return `${payloadPart}.${sign(payloadPart)}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadPart, signature] = token.split('.');
  if (!payloadPart || !signature) return null;
  const expected = sign(payloadPart);
  try {
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  } catch {
    return null;
  }
  try {
    const body = JSON.parse(fromB64url(payloadPart));
    if (!body?.email || !body?.userId || !body?.exp) return null;
    if (Number(body.v) !== TOKEN_VERSION) return null;
    if (Date.now() > Number(body.exp)) return null;
    return {
      userId: String(body.userId),
      email: String(body.email).trim().toLowerCase(),
      exp: Number(body.exp),
    };
  } catch {
    return null;
  }
}

export function readSessionTokenFromRequest(req) {
  const header = req.headers?.['x-session-token'] || req.headers?.['X-Session-Token'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof req.body?.sessionToken === 'string' && req.body.sessionToken.trim()) {
    return req.body.sessionToken.trim();
  }
  if (typeof req.query?.sessionToken === 'string' && req.query.sessionToken.trim()) {
    return req.query.sessionToken.trim();
  }
  return '';
}
