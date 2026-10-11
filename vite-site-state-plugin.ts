import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { BASE_TOTAL_UPGRADES, createFeedItem } from './src/lib/feed';
import { DEV_FEED_BOT_TICK_MS, DEV_FEED_WIN_RATE } from './src/lib/devLiveFeed';
import { driftPlayersOnline } from './src/lib/siteStorage';
import type { FeedItem } from './src/data/skins';
import { createUserStore } from './server/lib/userStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';

const BASE_REGISTERED_USERS = 7_539;

interface StoredSiteState {
  feed: FeedItem[];
  totalUpgrades: number;
  playersOnline: number;
  registeredUsers: number;
  registeredUsersDrift: number;
  updatedAt: number;
}

export interface SiteState {
  feed: FeedItem[];
  totalUpgrades: number;
  playersOnline: number;
  registeredUsers: number;
  updatedAt: number;
}

function readBody(req: { on: (event: string, cb: (chunk: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (s?: string) => void },
  status: number,
  data: unknown,
) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

function isFeedItem(value: unknown): value is FeedItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as FeedItem;
  return (
    typeof item.id === 'string'
    && typeof item.username === 'string'
    && typeof item.inputSkin === 'string'
    && typeof item.targetSkin === 'string'
    && (item.inputImage === undefined || typeof item.inputImage === 'string')
    && (item.targetImage === undefined || typeof item.targetImage === 'string')
    && typeof item.probability === 'number'
    && typeof item.won === 'boolean'
    && typeof item.timestamp === 'number'
  );
}

function createInitialState(): StoredSiteState {
  return {
    feed: Array.from({ length: 24 }, () => createFeedItem({ winRate: DEV_FEED_WIN_RATE })),
    totalUpgrades: BASE_TOTAL_UPGRADES,
    playersOnline: 500 + Math.floor(Math.random() * 300) + 1,
    registeredUsers: BASE_REGISTERED_USERS,
    registeredUsersDrift: 0,
    updatedAt: Date.now(),
  };
}

export function siteStatePlugin(stateDir: string, userDbDir?: string): Plugin {
  const userStore = userDbDir
    ? createUserStore({
      userDbDir,
      adminEmailsStore: createAdminEmailsStore(stateDir),
    })
    : null;

  return {
    name: 'site-state-api',
    configureServer(server) {
      if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });

      const stateFile = path.join(stateDir, 'state.json');

      const loadState = (): StoredSiteState => {
        if (!fs.existsSync(stateFile)) {
          const initial = createInitialState();
          fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2), 'utf8');
          return initial;
        }
        try {
          const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as Partial<StoredSiteState>;
          if (!Array.isArray(parsed.feed) || !parsed.feed.every(isFeedItem)) {
            const initial = createInitialState();
            fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2), 'utf8');
            return initial;
          }
          const registeredUsers = Math.max(
            BASE_REGISTERED_USERS,
            Math.floor(Number((parsed as { registeredUsers?: number }).registeredUsers) || 0),
            BASE_REGISTERED_USERS + Math.max(0, Math.floor(parsed.registeredUsersDrift ?? 0)),
          );
          return {
            feed: parsed.feed.slice(0, 40),
            totalUpgrades: Math.max(BASE_TOTAL_UPGRADES, Math.floor(parsed.totalUpgrades ?? BASE_TOTAL_UPGRADES)),
            playersOnline: Math.floor(parsed.playersOnline ?? 650),
            registeredUsers,
            registeredUsersDrift: Math.max(0, registeredUsers - BASE_REGISTERED_USERS),
            updatedAt: parsed.updatedAt ?? Date.now(),
          };
        } catch {
          const initial = createInitialState();
          fs.writeFileSync(stateFile, JSON.stringify(initial, null, 2), 'utf8');
          return initial;
        }
      };

      const saveState = (state: StoredSiteState) => {
        const registeredUsers = Math.max(
          BASE_REGISTERED_USERS,
          Math.floor(Number(state.registeredUsers) || 0),
        );
        const next: StoredSiteState = {
          feed: state.feed.slice(0, 40),
          totalUpgrades: Math.max(BASE_TOTAL_UPGRADES, Math.floor(state.totalUpgrades)),
          playersOnline: Math.floor(state.playersOnline),
          registeredUsers,
          registeredUsersDrift: Math.max(0, registeredUsers - BASE_REGISTERED_USERS),
          updatedAt: Date.now(),
        };
        fs.writeFileSync(stateFile, JSON.stringify(next, null, 2), 'utf8');
        return next;
      };

      const appendFeedItem = (state: StoredSiteState, item: FeedItem): StoredSiteState => ({
        ...state,
        feed: [item, ...state.feed.filter(existing => existing.id !== item.id)].slice(0, 40),
        totalUpgrades: state.totalUpgrades + 1,
        updatedAt: Date.now(),
      });

      let memoryState: StoredSiteState | null = null;
      let publicCache: { at: number; body: string } | null = null;

      const getMemoryState = (): StoredSiteState => {
        if (!memoryState) memoryState = loadState();
        return memoryState;
      };

      const persistState = (state: StoredSiteState): StoredSiteState => {
        memoryState = saveState(state);
        publicCache = null;
        return memoryState;
      };

      const buildPublicSiteState = (state: StoredSiteState): SiteState => ({
        feed: state.feed,
        totalUpgrades: state.totalUpgrades,
        playersOnline: state.playersOnline,
        registeredUsers: Math.max(BASE_REGISTERED_USERS, state.registeredUsers || 0),
        updatedAt: state.updatedAt,
      });

      const getPublicJson = (): string => {
        if (publicCache && Date.now() - publicCache.at < 1000) return publicCache.body;
        const body = JSON.stringify(buildPublicSiteState(getMemoryState()));
        publicCache = { at: Date.now(), body };
        return body;
      };

      const botTick = () => {
        const state = getMemoryState();
        const botItem = createFeedItem({ winRate: DEV_FEED_WIN_RATE });
        persistState({
          ...appendFeedItem(state, botItem),
          playersOnline: driftPlayersOnline(state.playersOnline),
        });
      };

      let registeredTimer: ReturnType<typeof setTimeout> | null = null;
      const scheduleRegisteredTick = () => {
        const delayMs = 25_000 + Math.floor(Math.random() * 75_001);
        registeredTimer = setTimeout(() => {
          const state = getMemoryState();
          persistState({
            ...state,
            registeredUsers: Math.max(BASE_REGISTERED_USERS, state.registeredUsers || 0) + 1,
          });
          scheduleRegisteredTick();
        }, delayMs);
      };

      // Seed feed once if empty; no repeating bot while developing.
      if (!getMemoryState().feed.length) botTick();
      scheduleRegisteredTick();
      void userStore;

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/site-state')) return next();

        try {
          if (req.method === 'GET' && (url === '/api/site-state' || url.startsWith('/api/site-state?'))) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(getPublicJson());
            return;
          }

          if (req.method === 'POST' && url === '/api/site-state/feed-event') {
            const body = JSON.parse(await readBody(req)) as FeedItem;
            if (!isFeedItem(body)) {
              sendJson(res, 400, { error: 'invalid feed item' });
              return;
            }
            persistState(appendFeedItem(getMemoryState(), body));
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(getPublicJson());
            return;
          }

          sendJson(res, 404, { error: 'not found' });
        } catch {
          sendJson(res, 500, { error: 'server error' });
        }
      });

      server.httpServer?.once('close', () => {
        if (registeredTimer) clearTimeout(registeredTimer);
      });
    },
  };
}
