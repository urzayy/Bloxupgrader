import {
  createSessionToken,
  readSessionTokenFromRequest,
  verifySessionToken,
} from './sessionTokens.mjs';

export { createSessionToken, readSessionTokenFromRequest, verifySessionToken };

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function clientIp(req) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Sync session check (token only). Prefer requireBoundUser for privileged actions.
 */
export function requireUser(req, res, { email } = {}) {
  const token = readSessionTokenFromRequest(req);
  const session = verifySessionToken(token);
  if (!session) {
    sendJson(res, 401, { error: 'auth_required', message: 'Sign in again.' });
    return null;
  }
  if (email && String(email).trim().toLowerCase() !== session.email) {
    sendJson(res, 403, { error: 'forbidden', message: 'Session mismatch.' });
    return null;
  }
  return session;
}

/**
 * Session must match a real account row (blocks forged register tokens).
 */
export async function requireBoundUser(req, res, userStore, { email } = {}) {
  const session = requireUser(req, res, { email });
  if (!session) return null;
  try {
    const account = await userStore.getAccountByEmail(session.email);
    const accountId = account?.id || account?.userId;
    if (!accountId || String(accountId) !== String(session.userId)) {
      sendJson(res, 403, { error: 'forbidden', message: 'Invalid session. Sign in again.' });
      return null;
    }
  } catch (error) {
    console.error('[auth] bind session failed', error);
    sendJson(res, 403, { error: 'forbidden', message: 'Invalid session. Sign in again.' });
    return null;
  }
  return session;
}

export async function requireAdmin(req, res, userStore, adminEmailsStore) {
  const session = await requireBoundUser(req, res, userStore);
  if (!session) return null;
  if (!adminEmailsStore.isAdminEmail(session.email)) {
    sendJson(res, 403, { error: 'forbidden', message: 'Admin only.' });
    return null;
  }
  return session;
}

export async function requireCreator(req, res, userStore, adminEmailsStore) {
  const session = await requireBoundUser(req, res, userStore);
  if (!session) return null;
  if (!adminEmailsStore.isCreatorEmail(session.email)) {
    sendJson(res, 403, { error: 'forbidden', message: 'Creator only.' });
    return null;
  }
  return session;
}
