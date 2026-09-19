import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireBoundUser, requireCreator, sendJson } from './server/lib/httpAuth.mjs';
import { rejectSelfGrant, requireCreatorOrOperator } from './server/lib/operatorGate.mjs';

interface GrantSkin {
  id: string;
  name: string;
  weapon: string;
  rarity: string;
  wear: string;
  price: number;
  image: string;
}

interface InventoryGrant {
  id: string;
  targetEmail: string;
  grantedBy: string;
  skin: GrantSkin;
  createdAt: number;
  status: 'pending' | 'applied';
}

interface GrantStore {
  email: string;
  grants: InventoryGrant[];
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
  const file = storePath(grantsDir, email);
  if (!fs.existsSync(file)) {
    return { email: email.trim().toLowerCase(), grants: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as GrantStore;
    if (!parsed?.grants) return { email: email.trim().toLowerCase(), grants: [] };
    return parsed;
  } catch {
    return { email: email.trim().toLowerCase(), grants: [] };
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

export function inventoryGrantsPlugin(grantsDir: string): Plugin {
  const root = path.dirname(grantsDir);
  const adminEmailsStore = createAdminEmailsStore(path.resolve(root, 'site-state'));
  const userStore = createUserStore({
    userDbDir: path.resolve(root, 'user-db'),
    adminEmailsStore,
  });

  return {
    name: 'inventory-grants-api',
    configureServer(server) {
      if (!fs.existsSync(grantsDir)) fs.mkdirSync(grantsDir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/inventory-grants')) return next();

        try {
          if (req.method === 'GET' && url.startsWith('/api/inventory-grants?')) {
            const query = new URL(url, 'http://local').searchParams;
            const email = query.get('email')?.trim().toLowerCase();
            if (!email) {
              sendJson(res, 400, { error: 'email required' });
              return;
            }
            const session = await requireSelfOrAdmin(req, res, userStore, adminEmailsStore, email);
            if (!session) return;
            const store = loadStore(grantsDir, email);
            const grants = store.grants.filter(g => g.status === 'pending');
            sendJson(res, 200, { grants });
            return;
          }

          if (req.method === 'POST' && url === '/api/inventory-grants/ack') {
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

          if (req.method === 'POST' && url === '/api/inventory-grants') {
            const authority = await requireCreatorOrOperator(
              req,
              res,
              sendJson,
              (r, s) => requireCreator(r, s, userStore, adminEmailsStore),
            );
            if (!authority) return;
            const body = JSON.parse(await readBody(req)) as {
              targetEmail: string;
              skin: GrantSkin;
              quantity?: number;
            };
            const targetEmail = body.targetEmail?.trim().toLowerCase();
            if (!targetEmail || !body.skin?.id) {
              sendJson(res, 400, { error: 'invalid grant' });
              return;
            }
            if (rejectSelfGrant(sendJson, res, authority.email, targetEmail)) return;
            const quantity = Math.min(99, Math.max(1, Math.floor(body.quantity ?? 1)));
            const safeSkin: GrantSkin = {
              id: String(body.skin.id).slice(0, 128),
              name: String(body.skin.name || 'Item').slice(0, 128),
              weapon: String(body.skin.weapon || '').slice(0, 64),
              rarity: String(body.skin.rarity || '').slice(0, 32),
              wear: String(body.skin.wear || '').slice(0, 32),
              price: Math.min(500_000, Math.max(0, Math.floor(Number(body.skin.price) || 0))),
              image: String(body.skin.image || '').slice(0, 512),
            };
            const store = loadStore(grantsDir, targetEmail);
            const now = Date.now();
            const grants: InventoryGrant[] = Array.from({ length: quantity }, (_, index) => ({
              id: `grant_${now}_${index}_${Math.random().toString(36).slice(2, 8)}`,
              targetEmail,
              grantedBy: authority.email,
              skin: safeSkin,
              createdAt: now + index,
              status: 'pending' as const,
            }));
            store.grants.push(...grants);
            saveStore(grantsDir, store);
            sendJson(res, 200, { grants, quantity });
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
