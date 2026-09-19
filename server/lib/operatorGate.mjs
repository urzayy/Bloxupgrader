import { timingSafeEqual } from 'node:crypto';

/**
 * Runtime gift / announcement / promo writes are locked by default.
 * They only succeed when OPERATOR_ACTION_SECRET is set and the request
 * sends the same value in X-Operator-Secret (or body.operatorSecret).
 * Admin sessions alone are never enough — blocks self-grants via DevTools.
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

/**
 * @returns {boolean} true if allowed; otherwise response already sent
 */
export function requireOperatorAction(req, res, sendJson) {
  const expected = String(process.env.OPERATOR_ACTION_SECRET || '').trim();
  if (expected.length < 24) {
    sendJson(res, 403, {
      error: 'actions_locked',
      message: 'Gifts and announcements are locked. Only the site operator can enable them.',
    });
    return false;
  }
  const provided = readProvidedSecret(req);
  if (!provided || !secretsEqual(expected, provided)) {
    sendJson(res, 403, {
      error: 'actions_locked',
      message: 'Gifts and announcements are locked.',
    });
    return false;
  }
  return true;
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
