import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { createCaseBattleStore } from './server/lib/caseBattleStore.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import { requireBoundUser, sendJson } from './server/lib/httpAuth.mjs';

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

function isBattleParticipant(
  battle: { players?: Array<{ isBot?: boolean; id?: string; userId?: string }> } | null | undefined,
  userId: string,
): boolean {
  if (!Array.isArray(battle?.players)) return false;
  const uid = String(userId).toLowerCase();
  return battle.players.some(p => !p?.isBot && (
    String(p?.id || '').toLowerCase() === uid
    || String(p?.userId || '').toLowerCase() === uid
  ));
}

export function caseBattlesPlugin(caseBattlesDir: string): Plugin {
  if (!fs.existsSync(caseBattlesDir)) fs.mkdirSync(caseBattlesDir, { recursive: true });
  const siteStateDir = path.resolve(path.dirname(caseBattlesDir), 'site-state');
  const adminEmailsStore = createAdminEmailsStore(siteStateDir);
  const userStore = createUserStore({
    userDbDir: path.resolve(path.dirname(caseBattlesDir), 'user-db'),
    adminEmailsStore,
  });
  const caseBattleStore = createCaseBattleStore(caseBattlesDir);

  return {
    name: 'case-battles-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        try {
          if (url === '/api/case-battles' && req.method === 'GET') {
            sendJson(res, 200, { battles: caseBattleStore.listLive() });
            return;
          }

          const detailMatch = url.match(/^\/api\/case-battles\/([^/]+)$/);
          if (detailMatch && req.method === 'GET') {
            const battle = caseBattleStore.getById(detailMatch[1]);
            if (!battle) {
              sendJson(res, 404, { error: 'not_found' });
              return;
            }
            sendJson(res, 200, { battle });
            return;
          }

          if (detailMatch && req.method === 'PUT') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            const body = await readJsonBody(req) as {
              battle?: {
                id?: string;
                createdByUserId?: string;
                hostUserId?: string;
                players?: Array<{ isBot?: boolean; id?: string; userId?: string }>;
              };
            };
            const battle = body.battle;
            if (!battle?.id || String(battle.id).toLowerCase() !== detailMatch[1].toLowerCase()) {
              sendJson(res, 400, { error: 'invalid_battle' });
              return;
            }
            const existing = caseBattleStore.getById(detailMatch[1]);
            const isCreator = String(battle.createdByUserId || '').toLowerCase() === String(session.userId).toLowerCase();
            const isParticipant = isBattleParticipant(battle, session.userId);
            const wasParticipant = existing ? isBattleParticipant(existing, session.userId) : false;
            const isAdmin = adminEmailsStore.isAdminEmail(session.email);
            if (!isCreator && !isParticipant && !wasParticipant && !isAdmin) {
              sendJson(res, 403, { error: 'forbidden', message: 'Not a battle participant.' });
              return;
            }
            if (existing) {
              battle.createdByUserId = existing.createdByUserId ?? existing.hostUserId;
              if (existing.hostUserId) battle.hostUserId = existing.hostUserId;
            } else {
              battle.createdByUserId = session.userId;
              battle.hostUserId = session.userId;
            }
            const result = caseBattleStore.upsert(battle);
            if (result.error) {
              sendJson(res, 400, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (detailMatch && req.method === 'DELETE') {
            const session = await requireBoundUser(req, res, userStore);
            if (!session) return;
            const existing = caseBattleStore.getById(detailMatch[1]);
            if (!existing) {
              sendJson(res, 404, { error: 'not_found' });
              return;
            }
            const isAdmin = adminEmailsStore.isAdminEmail(session.email);
            const isHost = String(existing.hostUserId || existing.createdByUserId || '').toLowerCase() === String(session.userId).toLowerCase();
            const isParticipant = isBattleParticipant(existing, session.userId);
            if (!isAdmin && !isHost && !isParticipant) {
              sendJson(res, 403, { error: 'forbidden', message: 'Only host or participant can remove this battle.' });
              return;
            }
            const result = caseBattleStore.remove(detailMatch[1]);
            if (result.error) {
              sendJson(res, 404, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }
        } catch (error) {
          console.error('[case-battles-api]', error);
          sendJson(res, 500, { error: 'error' });
          return;
        }

        next();
      });
    },
  };
}
