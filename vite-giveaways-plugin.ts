import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createGiveawayStore } from './server/lib/giveawayStore.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireAdmin, requireBoundUser, sendJson } from './server/lib/httpAuth.mjs';

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

export function giveawaysPlugin(giveawaysDir: string, userDbDir: string, grantsDir: string): Plugin {
  if (!fs.existsSync(giveawaysDir)) fs.mkdirSync(giveawaysDir, { recursive: true });
  const siteStateDir = path.resolve(path.dirname(userDbDir), 'site-state');
  const adminEmailsStore = createAdminEmailsStore(siteStateDir);
  const giveawayStore = createGiveawayStore(giveawaysDir, grantsDir);
  const userStore = createUserStore({ userDbDir, adminEmailsStore });

  return {
    name: 'giveaways-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        try {
          if (url === '/api/giveaways' && req.method === 'GET') {
            sendJson(res, 200, giveawayStore.getAll());
            return;
          }

          const detailMatch = url.match(/^\/api\/giveaways\/(daily|weekly|monthly)$/);
          if (detailMatch && req.method === 'GET') {
            const period = detailMatch[1];
            const query = new URL(req.url ?? '', 'http://localhost').searchParams;
            const userId = query.get('userId');
            const detail = giveawayStore.getDetail(period, userId);
            if (detail.error) {
              sendJson(res, 400, { error: detail.error });
              return;
            }
            sendJson(res, 200, detail);
            return;
          }

          if (url === '/api/giveaways/join' && req.method === 'POST') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              period?: string;
              nickname?: string;
              avatarId?: number;
            };
            const result = giveawayStore.joinGiveaway(body.period, {
              userId: session.userId,
              email: session.email,
              nickname: body.nickname,
              avatarId: body.avatarId,
            });
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (url === '/api/giveaways/deposit-record' && req.method === 'POST') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              amount?: number;
              nickname?: string;
              avatarId?: number;
            };
            const amount = Number(body.amount);
            if (!Number.isFinite(amount) || amount <= 0) {
              sendJson(res, 400, { error: 'invalid_payload' });
              return;
            }
            const updates = giveawayStore.recordUserDeposit(session.userId, Math.min(amount, 50000), {
              email: session.email,
              nickname: body.nickname,
              avatarId: body.avatarId,
            });
            sendJson(res, 200, { ok: true, updates });
            return;
          }

          if (url === '/api/giveaways/winners' && req.method === 'GET') {
            const query = new URL(req.url ?? '', 'http://localhost').searchParams;
            const limit = Number(query.get('limit') ?? 24);
            sendJson(res, 200, giveawayStore.listWinners(Number.isFinite(limit) ? limit : 24));
            return;
          }

          if (url === '/api/giveaways/pending-win' && req.method === 'GET') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            sendJson(res, 200, giveawayStore.listPendingWins(session.userId));
            return;
          }

          if (url === '/api/giveaways/pending-win/ack' && req.method === 'POST') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            const body = await readJsonBody(req) as { pendingId?: string };
            const pendingId = String(body.pendingId ?? '').trim();
            if (!pendingId) {
              sendJson(res, 400, { error: 'invalid_ack' });
              return;
            }
            const result = giveawayStore.ackPendingWin(session.userId, pendingId);
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (url === '/api/admin/giveaways/open' && req.method === 'POST') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              period?: string;
              skin?: unknown;
              depositRequirement?: number;
            };
            const result = giveawayStore.openGiveaway({
              period: body.period,
              skin: body.skin,
              depositRequirement: body.depositRequirement,
              openedBy: session.email,
            });
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (url === '/api/admin/giveaways/close' && req.method === 'POST') {
            const session = await requireAdmin(req, res, userStore, adminEmailsStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              period?: string;
              pickWinner?: boolean;
            };
            const result = giveawayStore.closeGiveaway({
              period: body.period,
              pickWinner: Boolean(body.pickWinner),
              grantedBy: session.email,
            });
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }
        } catch (error) {
          console.error('[giveaways-api]', error);
          sendJson(res, 500, { error: 'error' });
          return;
        }

        next();
      });
    },
  };
}
