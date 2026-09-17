import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12h

function getSecret() {
  const secret = String(
    process.env.SESSION_TOKEN_SECRET
    || process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SITE_URL
    || 'bloxupgrader-dev-session-secret',
  ).trim();
  return secret.length >= 16 ? secret : `${secret}:bloxupgrader-session-v1`;
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
