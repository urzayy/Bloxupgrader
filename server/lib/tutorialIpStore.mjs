import fs from 'node:fs';
import path from 'node:path';

const FILE = 'tutorial-ips.json';
const MAX_IPS = 50_000;

function normalizeIp(ip) {
  let value = String(ip || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (value.startsWith('::ffff:')) value = value.slice(7);
  if (value === '::1') return '127.0.0.1';
  return value;
}

export function createTutorialIpStore(stateDir) {
  const filePath = path.join(stateDir, FILE);

  function read() {
    try {
      if (!fs.existsSync(filePath)) return { ips: {}, updatedAt: 0 };
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const ips = raw && typeof raw.ips === 'object' && !Array.isArray(raw.ips) ? raw.ips : {};
      return { ips, updatedAt: Number(raw.updatedAt) || 0 };
    } catch {
      return { ips: {}, updatedAt: 0 };
    }
  }

  function write(state) {
    fs.mkdirSync(stateDir, { recursive: true });
    const entries = Object.entries(state.ips);
    if (entries.length > MAX_IPS) {
      entries.sort((a, b) => Number(a[1] || 0) - Number(b[1] || 0));
      state.ips = Object.fromEntries(entries.slice(entries.length - MAX_IPS));
    }
    state.updatedAt = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
  }

  return {
    hasSeen(ip) {
      const key = normalizeIp(ip);
      const state = read();
      return Boolean(state.ips[key]);
    },
    markSeen(ip) {
      const key = normalizeIp(ip);
      const state = read();
      state.ips[key] = Date.now();
      write(state);
      return true;
    },
  };
}
