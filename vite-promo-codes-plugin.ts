import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createPromoCodeStore } from './server/lib/promoCodeStore.mjs';
import { initPromoCodeStore } from './server/lib/depositBonus.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireAdmin, sendJson } from './server/lib/httpAuth.mjs';

function readBody(req: { on: (event: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

export function promoCodesPlugin(promoCodesDir: string, userDbDir: string): Plugin {
  const promoCodeStore = createPromoCodeStore(promoCodesDir);
  initPromoCodeStore(promoCodeStore);
  const siteStateDir = path.resolve(path.dirname(userDbDir), 'site-state');
  const adminEmailsStore = createAdminEmailsStore(siteStateDir);
  const userStore = createUserStore({ userDbDir, adminEmailsStore });

  return {
    name: 'promo-codes-api',
    configureServer(server) {
      if (!fs.existsSync(promoCodesDir)) fs.mkdirSync(promoCodesDir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/promo-codes') && !url.startsWith('/api/admin/promo-codes')) {
          return next();
        }

        try {
          if (req.method === 'GET' && url.startsWith('/api/promo-codes/validate')) {
            const code = new URL(url, 'http://local').searchParams.get('code') ?? '';
            sendJson(res, 200, promoCodeStore.validateCode(code));
            return;
          }

          if (req.method === 'GET' && url.startsWith('/api/admin/promo-codes')) {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            sendJson(res, 200, { codes: promoCodeStore.listCodes() });
            return;
          }

          if (req.method === 'POST' && url === '/api/admin/promo-codes') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = JSON.parse(await readBody(req)) as {
              code?: string;
              percent?: number;
              durationValue?: number;
              durationUnit?: 'hours' | 'days' | 'permanent';
            };
            const result = promoCodeStore.createCode({
              code: String(body.code ?? ''),
              percent: Number(body.percent),
              durationValue: body.durationValue,
              durationUnit: body.durationUnit ?? 'permanent',
              createdBy: session.email,
            });
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, { entry: result.entry });
            return;
          }

          const deleteMatch = url.match(/^\/api\/admin\/promo-codes\/([^/?]+)/);
          if (req.method === 'DELETE' && deleteMatch) {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const code = decodeURIComponent(deleteMatch[1] ?? '');
            const result = promoCodeStore.deleteCode(code);
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, { ok: true, entry: result.entry });
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
