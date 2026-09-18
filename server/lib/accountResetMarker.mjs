import fs from 'node:fs';
import path from 'node:path';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sanitizeEmail(email) {
  return normalizeEmail(email).replace(/@/g, '_at_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function createAccountResetMarkerStore(rootDir) {
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

  const filePath = (email) => path.join(rootDir, `${sanitizeEmail(email)}.json`);
  const ackPath = (email) => path.join(rootDir, `${sanitizeEmail(email)}.ack.json`);
  const globalPath = path.join(rootDir, '_all.json');

  function readResetAt(file) {
    if (!fs.existsSync(file)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const resetAt = Number(parsed?.resetAt ?? 0);
      return Number.isFinite(resetAt) && resetAt > 0 ? resetAt : null;
    } catch {
      return null;
    }
  }

  function readAckAt(email) {
    const file = ackPath(email);
    if (!fs.existsSync(file)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ackAt = Number(parsed?.ackAt ?? 0);
      return Number.isFinite(ackAt) && ackAt > 0 ? ackAt : null;
    } catch {
      return null;
    }
  }

  return {
    markReset(email) {
      const normalizedEmail = normalizeEmail(email);
      const resetAt = Date.now();
      fs.writeFileSync(
        filePath(normalizedEmail),
        JSON.stringify({ email: normalizedEmail, resetAt }, null, 2),
        'utf8',
      );
      return resetAt;
    },
    markGlobalReset() {
      const resetAt = Date.now();
      fs.writeFileSync(
        globalPath,
        JSON.stringify({ scope: 'all', resetAt }, null, 2),
        'utf8',
      );
      return resetAt;
    },
    getGlobalResetAt() {
      return readResetAt(globalPath);
    },
    getResetAt(email) {
      const normalizedEmail = normalizeEmail(email);
      const perEmail = readResetAt(filePath(normalizedEmail));
      const global = readResetAt(globalPath);
      const ackAt = readAckAt(normalizedEmail);

      let pending = null;
      if (perEmail && (!ackAt || ackAt < perEmail)) pending = perEmail;
      if (global && (!ackAt || ackAt < global)) {
        pending = Math.max(pending ?? 0, global);
      }
      return pending;
    },
    clearReset(email, resetAt) {
      const normalizedEmail = normalizeEmail(email);
      const ackAt = Number(resetAt) || Date.now();
      fs.writeFileSync(
        ackPath(normalizedEmail),
        JSON.stringify({ email: normalizedEmail, ackAt }, null, 2),
        'utf8',
      );
      const perFile = filePath(normalizedEmail);
      if (fs.existsSync(perFile)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(perFile, 'utf8'));
          if (Number(parsed?.resetAt ?? 0) <= ackAt) fs.unlinkSync(perFile);
        } catch {
          fs.unlinkSync(perFile);
        }
      }
    },
  };
}
