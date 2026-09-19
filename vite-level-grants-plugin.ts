import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireBoundUser, requireCreator, sendJson } from './server/lib/httpAuth.mjs';
import { rejectSelfGrant, requireCreatorOrOperator } from './server/lib/operatorGate.mjs';

const MAX_LEVEL = 90;

interface LevelGrant {
  id: string;
  targetEmail: string;
  grantedBy: string;
  level: number;
  createdAt: number;
  status: 'pending' | 'applied';
}

interface GrantStore {
  email: string;
  grants: LevelGrant[];
}

function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().replace(/@/g, '_at_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function readBody(req: { on: (event: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function storePath(grantsDir: string, email: string): string {
  return path.join(grantsDir, `${sanitizeEmail(email)}.json`);
}

function loadStore(grantsDir: string, email: string): GrantStore {
  const normalized = email.trim().toLowerCase();
  const file = storePath(grantsDir, normalized);
  if (!fs.existsSync(file)) return { email: normalized, grants: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GrantStore;
    if (!parsed?.grants) return { email: normalized, grants: [] };
    return parsed;
  } catch {
    return { email: normalized, grants: [] };
  }
}

function saveStore(grantsDir: string, store: GrantStore) {
  if (!fs.existsSync(grantsDir)) fs.mkdirSync(grantsDir, { recursive: true });
  fs.writeFileSync(storePath(grantsDir, store.email), JSON.stringify(store, null, 2), 'utf8');
}

async function requireSelfOrAdmin(
  req: unknown,
  res: unknown,
  userStore: ReturnType<typeof createUserStore>,
  adminEmailsStore: ReturnType<typeof createAdminEmailsStore>,
  email: string,
) {
  const session = await requireBoundUser(req, res, userStore);
  if (!session) return null;
  const normalized = email.trim().toLowerCase();
  if (session.email === normalized || adminEmailsStore.isAdminEmail(session.email)) {
    return session;
  }
  sendJson(res, 403, { error: 'forbidden', message: 'Session mismatch.' });
  return null;
}

export function levelGrantsPlugin(grantsDir: string): Plugin {
  const root = path.dirname(grantsDir);
  const adminEmailsStore = createAdminEmailsStore(path.resolve(root, 'site-state'));
  const userStore = createUserStore({
    userDbDir: path.resolve(root, 'user-db'),
    adminEmailsStore,
  });

  return {
    name: 'level-grants-api',
    configureServer(server) {
      if (!fs.existsSync(grantsDir)) fs.mkdirSync(grantsDir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/level-grants')) return next();

        try {
          if (req.method === 'GET' && url.startsWith('/api/level-grants?')) {
            const query = new URL(url, 'http://local').searchParams;
            const email = query.get('email')?.trim().toLowerCase();
            if (!email) {
              sendJson(res, 400, { error: 'email required' });
              return;
            }
            const session = await requireSelfOrAdmin(req, res, userStore, adminEmailsStore, email);
            if (!session) return;
            const store = loadStore(grantsDir, email);
            sendJson(res, 200, { grants: store.grants.filter(g => g.status === 'pending') });
            return;
          }

          if (req.method === 'POST' && url === '/api/level-grants/ack') {
            const body = JSON.parse(await readBody(req)) as { email: string; grantIds: string[] };
            const email = body.email?.trim().toLowerCase();
            if (!email || !Array.isArray(body.grantIds)) {
              sendJson(res, 400, { error: 'invalid ack' });
              return;
            }
            const session = await requireSelfOrAdmin(req, res, userStore, adminEmailsStore, email);
            if (!session) return;
            const store = loadStore(grantsDir, email);
            const ids = new Set(body.grantIds);
            store.grants = store.grants.map(g =>
              ids.has(g.id) ? { ...g, status: 'applied' as const } : g,
            );
            saveStore(grantsDir, store);
            sendJson(res, 200, { ok: true });
            return;
          }

          if (req.method === 'POST' && url === '/api/level-grants') {
            const authority = await requireCreatorOrOperator(
              req,
              res,
              sendJson,
              (r, s) => requireCreator(r, s, userStore, adminEmailsStore),
            );
            if (!authority) return;
            const body = JSON.parse(await readBody(req)) as {
              targetEmail: string;
              level: number;
            };
            const targetEmail = body.targetEmail?.trim().toLowerCase();
            const level = Math.floor(Number(body.level));
            if (
              !targetEmail
              || !Number.isFinite(level)
              || level < 1
              || level > MAX_LEVEL
            ) {
              sendJson(res, 400, { error: 'invalid grant' });
              return;
            }
            if (rejectSelfGrant(sendJson, res, authority.email, targetEmail)) return;
            const store = loadStore(grantsDir, targetEmail);
            const now = Date.now();
            const grant: LevelGrant = {
              id: `lvl_${now}_${Math.random().toString(36).slice(2, 8)}`,
              targetEmail,
              grantedBy: authority.email,
              level,
              createdAt: now,
              status: 'pending',
            };
            store.grants.push(grant);
            saveStore(grantsDir, store);
            sendJson(res, 200, { grant });
            return;
          }

          sendJson(res, 404, { error: 'not found' });
        } catch {
          sendJson(res, 500, { error: 'server error' });
        }
      });
    },
  };
}
