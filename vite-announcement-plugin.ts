import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createAnnouncementStore } from './server/lib/announcementStore.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireAdmin, sendJson } from './server/lib/httpAuth.mjs';

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

export function announcementPlugin(announcementsDir: string, userDbDir: string): Plugin {
  if (!fs.existsSync(announcementsDir)) fs.mkdirSync(announcementsDir, { recursive: true });
  const siteStateDir = path.resolve(path.dirname(userDbDir), 'site-state');
  const adminEmailsStore = createAdminEmailsStore(siteStateDir);
  const announcementStore = createAnnouncementStore(announcementsDir);
  const userStore = createUserStore({ userDbDir, adminEmailsStore });

  return {
    name: 'announcement-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        try {
          if (url === '/api/announcement/active' && req.method === 'GET') {
            sendJson(res, 200, { announcement: announcementStore.getActive() });
            return;
          }

          if (url === '/api/admin/announcement' && req.method === 'GET') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            sendJson(res, 200, { announcement: announcementStore.getActive() });
            return;
          }

          if (url === '/api/admin/announcement' && req.method === 'POST') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              title?: string;
              message?: string;
            };
            const result = announcementStore.publish({
              title: body.title,
              message: body.message,
              createdBy: session.email,
            });
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (url === '/api/admin/announcement/clear' && req.method === 'POST') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            await readJsonBody(req);
            sendJson(res, 200, announcementStore.clear());
            return;
          }

          next();
        } catch (error) {
          console.error('[announcement-api]', error);
          sendJson(res, 500, { error: 'internal_error' });
        }
      });
    },
  };
}
