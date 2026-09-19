import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { requireCreator, sendJson } from './server/lib/httpAuth.mjs';

function readJsonBody(req: { on: (event: string, cb: (chunk: Buffer) => void) => void }): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

export function adminEmailsPlugin(stateDir: string): Plugin {
  if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
  const adminEmailsStore = createAdminEmailsStore(stateDir);
  const userDbDir = path.resolve(path.dirname(stateDir), 'user-db');
  const userStore = createUserStore({ userDbDir, adminEmailsStore });

  return {
    name: 'admin-emails-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        if (!url.startsWith('/api/admin/status') && !url.startsWith('/api/admin/emails')) {
          return next();
        }

        try {
          if (req.method === 'GET' && url === '/api/admin/status') {
            const params = new URL(req.url ?? '', 'http://local').searchParams;
            const email = params.get('email')?.trim().toLowerCase() ?? '';
            sendJson(res, 200, {
              isAdmin: adminEmailsStore.isAdminEmail(email),
              isCreator: adminEmailsStore.isCreatorEmail(email),
            });
            return;
          }

          if (req.method === 'GET' && url === '/api/admin/emails') {
            const session = await requireCreator(req, res, userStore, adminEmailsStore);
            if (!session) return;
            sendJson(res, 200, { emails: adminEmailsStore.listAdmins() });
            return;
          }

          if (req.method === 'POST' && url === '/api/admin/emails/add') {
            const session = await requireCreator(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = await readJsonBody(req) as { email?: string };
            try {
              const result = adminEmailsStore.addAdmin(
                session.email,
                String(body.email ?? '').trim(),
              );
              sendJson(res, 200, { ok: true, ...result });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'error';
              const status = message.includes('creator') || message.includes('locked') ? 403 : 400;
              sendJson(res, status, { error: message });
            }
            return;
          }

          if (req.method === 'POST' && url === '/api/admin/emails/remove') {
            const session = await requireCreator(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = await readJsonBody(req) as { email?: string };
            try {
              const result = adminEmailsStore.removeAdmin(
                session.email,
                String(body.email ?? '').trim(),
              );
              sendJson(res, 200, { ok: true, ...result });
            } catch (error) {
              const message = error instanceof Error ? error.message : 'error';
              const status = message.includes('creator') || message.includes('locked') ? 403 : 400;
              sendJson(res, status, { error: message });
            }
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

export function createDevAdminEmailsStore(stateDir: string) {
  return createAdminEmailsStore(stateDir);
}
