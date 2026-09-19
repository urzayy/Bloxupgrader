import fs from 'node:fs';
import path from 'node:path';

export const CREATOR_EMAIL = 'urzay1v1@gmail.com';

/** Only these accounts can ever be admins unless ALLOW_DYNAMIC_ADMINS=1. */
export const DEFAULT_ADMINS = [CREATOR_EMAIL, 'ecruzcastillo2009@gmail.com'];

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function dynamicAdminsAllowed() {
  return process.env.ALLOW_DYNAMIC_ADMINS === '1';
}

export function createAdminEmailsStore(stateDir) {
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

  const filePath = path.join(stateDir, 'admins.json');
  const cacheKey = path.resolve(stateDir);
  if (createAdminEmailsStore._cache?.has(cacheKey)) {
    return createAdminEmailsStore._cache.get(cacheKey);
  }

  function saveEmails(emails) {
    const normalized = [...new Set([
      CREATOR_EMAIL,
      ...emails.map(normalizeEmail).filter(isValidEmail),
    ])];
    // Hard lockdown: never persist console/API-injected admins unless explicitly allowed.
    const locked = dynamicAdminsAllowed()
      ? normalized
      : [...new Set(DEFAULT_ADMINS.map(normalizeEmail))];
    const payload = { emails: locked, updatedAt: Date.now() };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  function loadRaw() {
    // Always rewrite the pinned list so a poisoned durable backup cannot stick.
    return saveEmails(DEFAULT_ADMINS);
  }

  function listAdmins() {
    if (!dynamicAdminsAllowed()) {
      return [...DEFAULT_ADMINS].map(normalizeEmail).sort((a, b) => a.localeCompare(b));
    }
    if (!fs.existsSync(filePath)) return loadRaw().emails.slice().sort((a, b) => a.localeCompare(b));
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const emails = Array.isArray(parsed.emails)
        ? parsed.emails.map(normalizeEmail).filter(isValidEmail)
        : [];
      return [...new Set([CREATOR_EMAIL, ...emails])].sort((a, b) => a.localeCompare(b));
    } catch {
      return loadRaw().emails.slice().sort((a, b) => a.localeCompare(b));
    }
  }

  function isCreatorEmail(email) {
    return normalizeEmail(email) === CREATOR_EMAIL;
  }

  function isAdminEmail(email) {
    const normalized = normalizeEmail(email);
    if (!normalized) return false;
    return listAdmins().includes(normalized);
  }

  function assertCreator(creatorEmail) {
    if (!isCreatorEmail(creatorEmail)) {
      throw new Error('Only the creator can manage administrators');
    }
  }

  function addAdmin(creatorEmail, newEmail) {
    assertCreator(creatorEmail);
    if (!dynamicAdminsAllowed()) {
      throw new Error('Dynamic admin invites are locked. Set ALLOW_DYNAMIC_ADMINS=1 to enable.');
    }
    const normalized = normalizeEmail(newEmail);
    if (!isValidEmail(normalized)) {
      throw new Error('Invalid email address');
    }
    const current = listAdmins();
    if (current.includes(normalized)) {
      return { added: false, emails: current };
    }
    const saved = saveEmails([...current, normalized]);
    return { added: true, emails: saved.emails };
  }

  function removeAdmin(creatorEmail, targetEmail) {
    assertCreator(creatorEmail);
    if (!dynamicAdminsAllowed()) {
      throw new Error('Dynamic admin invites are locked. Set ALLOW_DYNAMIC_ADMINS=1 to enable.');
    }
    const normalized = normalizeEmail(targetEmail);
    if (normalized === CREATOR_EMAIL) {
      throw new Error('Cannot remove the creator account');
    }
    const current = listAdmins();
    if (!current.includes(normalized)) {
      return { removed: false, emails: current };
    }
    const saved = saveEmails(current.filter(email => email !== normalized));
    return { removed: true, emails: saved.emails };
  }

  function enforceLockdown() {
    const locked = saveEmails(DEFAULT_ADMINS);
    return locked.emails;
  }

  // Boot: wipe any poisoned admins.json from disk/durable restore.
  const locked = enforceLockdown();
  console.warn(`[admins] lockdown pinned → ${locked.join(', ')}`);

  const api = {
    CREATOR_EMAIL,
    DEFAULT_ADMINS,
    listAdmins,
    isCreatorEmail,
    isAdminEmail,
    addAdmin,
    removeAdmin,
    enforceLockdown,
  };
  if (!createAdminEmailsStore._cache) createAdminEmailsStore._cache = new Map();
  createAdminEmailsStore._cache.set(cacheKey, api);
  return api;
}
