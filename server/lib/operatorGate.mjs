import { timingSafeEqual } from 'node:crypto';

/**
 * Gift / announcement / promo writes:
 * - Creator session (urzay1v1), OR
 * - OPERATOR_ACTION_SECRET header
 * Regular admins cannot grant. Self-grants are also rejected.
 */

function readProvidedSecret(req) {
  const header = req.headers?.['x-operator-secret'] || req.headers?.['X-Operator-Secret'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  if (typeof req.body?.operatorSecret === 'string' && req.body.operatorSecret.trim()) {
    return req.body.operatorSecret.trim();
  }
  return '';
}

function secretsEqual(expected, provided) {
  try {
    const a = Buffer.from(String(expected));
    const b = Buffer.from(String(provided));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isOperatorActionConfigured() {
  return String(process.env.OPERATOR_ACTION_SECRET || '').trim().length >= 24;
}

export function hasValidOperatorSecret(req) {
  const expected = String(process.env.OPERATOR_ACTION_SECRET || '').trim();
  if (expected.length < 24) return false;
  const provided = readProvidedSecret(req);
  return Boolean(provided && secretsEqual(expected, provided));
}

/**
 * @deprecated Prefer requireCreatorOrOperator
 */
export function requireOperatorAction(req, res, sendJson) {
  if (hasValidOperatorSecret(req)) return true;
  sendJson(res, 403, {
    error: 'actions_locked',
    message: 'Gifts and announcements are locked. Creator only.',
  });
  return false;
}

/**
 * Creator session OR operator secret.
 * @returns {Promise<{ email: string, userId?: string } | null>}
 */
export async function requireCreatorOrOperator(req, res, _sendJson, requireCreatorSession) {
  if (hasValidOperatorSecret(req)) {
    return { email: 'operator', userId: 'operator' };
  }
  return requireCreatorSession(req, res);
}

/** Never allow granting to the same email that is performing the action. */
export function rejectSelfGrant(sendJson, res, actorEmail, targetEmail) {
  const actor = String(actorEmail || '').trim().toLowerCase();
  const target = String(targetEmail || '').trim().toLowerCase();
  if (actor && target && actor === target) {
    sendJson(res, 403, {
      error: 'self_grant_forbidden',
      message: 'You cannot grant to yourself.',
    });
    return true;
  }
  return false;
}
