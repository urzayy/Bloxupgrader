import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import {
  createBotFeedItem,
  enrichFeedItem,
  FEED_STATE_VERSION,
} from './src/lib/feedBot.mjs';
import { createUserStore } from './server/lib/userStore.mjs';
import { createPlayerStateStore } from './server/lib/playerStateStore.mjs';
import { createAdminEmailsStore } from './server/lib/adminEmailsStore.mjs';
import {
  createSessionToken,
  readSessionTokenFromRequest,
  verifySessionToken,
} from './server/lib/sessionTokens.mjs';
import { clearAccountByEmail as resetAccountByEmail, resetPlayerProgressByEmail } from './server/lib/accountReset.mjs';
import { createAccountResetMarkerStore } from './server/lib/accountResetMarker.mjs';
import { createAccountBanStore } from './server/lib/accountBanStore.mjs';
import { resolveDepositBonus, resolveRobuxDepositBonus, initPromoCodeStore } from './server/lib/depositBonus.mjs';
import { createPromoCodeStore } from './server/lib/promoCodeStore.mjs';
import { createAnnouncementStore } from './server/lib/announcementStore.mjs';
import { createProfilePhotoStore } from './server/lib/profilePhotoStore.mjs';
import { createGiveawayStore } from './server/lib/giveawayStore.mjs';
import { recordGiveawayDepositFromTicket } from './server/lib/giveawayDepositHook.mjs';
import { createCaseBattleStore } from './server/lib/caseBattleStore.mjs';
import { createWithdrawChatStore } from './server/lib/withdrawChatStore.mjs';
import { attachDurableDir, durableJsonEnabled } from './server/lib/durableJsonState.mjs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');

function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveDataDir() {
  const requested = (process.env.DATA_DIR || '').trim();
  const fallbacks = [requested, ROOT, path.join(os.tmpdir(), 'bloxupgrader-data')].filter(Boolean);
  for (const dir of fallbacks) {
    if (canWriteDir(dir)) {
      if (requested && dir !== requested) {
        console.warn(`[data] ${requested} is not writable; using ${dir}`);
      }
      return dir;
    }
  }
  return ROOT;
}

const DATA_DIR = resolveDataDir();
const USER_DB_DIR = process.env.USER_DB_DIR || path.join(DATA_DIR, 'user-db');
const PLAYER_STATE_DIR = process.env.PLAYER_STATE_DIR || path.join(DATA_DIR, 'player-state');
const ACCOUNT_RESETS_DIR = process.env.ACCOUNT_RESETS_DIR || path.join(DATA_DIR, 'account-resets');
const ACCOUNT_BANS_DIR = process.env.ACCOUNT_BANS_DIR || path.join(DATA_DIR, 'account-bans');
const LOGS_DIR = process.env.USER_LOGS_DIR || path.join(DATA_DIR, 'user-logs');
const CHATS_DIR = process.env.CHATS_DIR || path.join(DATA_DIR, 'withdraw-chats');
const GRANTS_DIR = process.env.GRANTS_DIR || path.join(DATA_DIR, 'inventory-grants');
const BALANCE_GRANTS_DIR = process.env.BALANCE_GRANTS_DIR || path.join(DATA_DIR, 'balance-grants');
const LEVEL_GRANTS_DIR = process.env.LEVEL_GRANTS_DIR || path.join(DATA_DIR, 'level-grants');
const STATE_DIR = process.env.STATE_DIR || path.join(DATA_DIR, 'site-state');
const PROMO_CODES_DIR = process.env.PROMO_CODES_DIR || path.join(DATA_DIR, 'promo-codes');
const ANNOUNCEMENTS_DIR = process.env.ANNOUNCEMENTS_DIR || path.join(DATA_DIR, 'announcements');
const PROFILE_PHOTOS_DIR = process.env.PROFILE_PHOTOS_DIR || path.join(DATA_DIR, 'profile-photos');
const GIVEAWAYS_DIR = process.env.GIVEAWAYS_DIR || path.join(DATA_DIR, 'giveaways');
const CASE_BATTLES_DIR = process.env.CASE_BATTLES_DIR || path.join(DATA_DIR, 'case-battles');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

const PORT = Number(process.env.PORT) || 4173;
const SITE_URL = process.env.SITE_URL || `http://localhost:${PORT}`;
const BASE_TOTAL_UPGRADES = 13_200;
const MIN_DEPOSIT_TOTAL = 1000;
const MIN_WITHDRAW_TOTAL = 20;

for (const dir of [DATA_DIR, LOGS_DIR, USER_DB_DIR, path.join(USER_DB_DIR, 'events'), PLAYER_STATE_DIR, ACCOUNT_RESETS_DIR, ACCOUNT_BANS_DIR, CHATS_DIR, GRANTS_DIR, BALANCE_GRANTS_DIR, LEVEL_GRANTS_DIR, STATE_DIR, PROMO_CODES_DIR, ANNOUNCEMENTS_DIR, PROFILE_PHOTOS_DIR, GIVEAWAYS_DIR, CASE_BATTLES_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}

const durableDirs = [
  ['account-resets', ACCOUNT_RESETS_DIR],
  ['account-bans', ACCOUNT_BANS_DIR],
  ['inventory-grants', GRANTS_DIR],
  ['balance-grants', BALANCE_GRANTS_DIR],
  ['level-grants', LEVEL_GRANTS_DIR],
  ['site-state', STATE_DIR],
  ['promo-codes', PROMO_CODES_DIR],
  ['announcements', ANNOUNCEMENTS_DIR],
  ['profile-photos', PROFILE_PHOTOS_DIR],
  ['giveaways', GIVEAWAYS_DIR],
  ['case-battles', CASE_BATTLES_DIR],
  // Extra safety: keep local chat/player mirrors across ephemeral deploys.
  ['withdraw-chats', CHATS_DIR],
  ['player-state', PLAYER_STATE_DIR],
].map(([key, dir]) => ({ key, dir, handle: attachDurableDir({ key, dir }) }));

await Promise.race([
  Promise.allSettled(durableDirs.map(entry => entry.handle.ready)),
  new Promise(resolve => setTimeout(resolve, 15_000)),
]);
if (durableJsonEnabled()) {
  console.log('[durable-json] file backup ready (or timed out; server will start anyway)');
}

const adminEmailsStore = createAdminEmailsStore(STATE_DIR);
const userStore = createUserStore({ userDbDir: USER_DB_DIR, adminEmailsStore });
const promoCodeStore = createPromoCodeStore(PROMO_CODES_DIR);
initPromoCodeStore(promoCodeStore);
const announcementStore = createAnnouncementStore(ANNOUNCEMENTS_DIR);
const playerStateStore = createPlayerStateStore({ playerStateDir: PLAYER_STATE_DIR, adminEmailsStore });
const resetMarkerStore = createAccountResetMarkerStore(ACCOUNT_RESETS_DIR);
const banStore = createAccountBanStore(ACCOUNT_BANS_DIR);
const profilePhotoStore = createProfilePhotoStore(PROFILE_PHOTOS_DIR);

// Re-pin admins every minute so poisoned durable/site-state cannot re-expand the list.
setInterval(() => {
  try {
    adminEmailsStore.enforceLockdown();
  } catch {
    /* ignore */
  }
}, 60_000).unref?.();

function requireUserSession(req, res, { email } = {}) {
  const token = readSessionTokenFromRequest(req);
  const session = verifySessionToken(token);
  if (!session) {
    sendJson(res, 401, { error: 'auth_required', message: 'Sign in again.' });
    return null;
  }
  if (email && String(email).trim().toLowerCase() !== session.email) {
    sendJson(res, 403, { error: 'forbidden', message: 'Session mismatch.' });
    return null;
  }
  return session;
}

function requireAdminSession(req, res) {
  const session = requireUserSession(req, res);
  if (!session) return null;
  if (!adminEmailsStore.isAdminEmail(session.email)) {
    sendJson(res, 403, { error: 'forbidden', message: 'Admin only.' });
    return null;
  }
  return session;
}

function requireCreatorSession(req, res) {
  const session = requireUserSession(req, res);
  if (!session) return null;
  if (!adminEmailsStore.isCreatorEmail(session.email)) {
    sendJson(res, 403, { error: 'forbidden', message: 'Creator only.' });
    return null;
  }
  return session;
}

const MAX_BALANCE_HARD_CAP = 2_000_000;
const MAX_BALANCE_SYNC_INCREASE = 250_000;
const giveawayStore = createGiveawayStore(GIVEAWAYS_DIR, GRANTS_DIR);
const caseBattleStore = createCaseBattleStore(CASE_BATTLES_DIR);
const withdrawChatStore = createWithdrawChatStore({ chatsDir: CHATS_DIR });
console.log(`[withdraw-chat] using ${withdrawChatStore.type} store`);
console.log(`[data] DATA_DIR=${DATA_DIR}`);

if (durableJsonEnabled()) {
  setInterval(() => {
    for (const entry of durableDirs) {
      try {
        entry.handle.persist();
      } catch {
        /* ignore backup errors */
      }
    }
  }, 60_000).unref?.();
}
let storageStatus = { ok: false, path: userStore.type === 'supabase' ? 'supabase' : USER_DB_DIR };

async function refreshStorageStatus() {
  storageStatus = await userStore.checkConnection();
}

function sanitizeEmail(email) {
  return email.replace(/@/g, '_at_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sendJson(res, status, data) {
  res.status(status).json(data);
}

function isFeedItem(value) {
  return (
    value
    && typeof value.id === 'string'
    && typeof value.username === 'string'
    && typeof value.inputSkin === 'string'
    && typeof value.targetSkin === 'string'
    && (value.inputImage === undefined || typeof value.inputImage === 'string')
    && (value.targetImage === undefined || typeof value.targetImage === 'string')
    && typeof value.probability === 'number'
    && typeof value.won === 'boolean'
    && typeof value.timestamp === 'number'
  );
}

function createInitialState() {
  return {
    feedVersion: FEED_STATE_VERSION,
    feed: Array.from({ length: 24 }, () => createBotFeedItem()),
    totalUpgrades: BASE_TOTAL_UPGRADES,
    playersOnline: 500 + Math.floor(Math.random() * 300) + 1,
    registeredUsersDrift: 0,
    updatedAt: Date.now(),
  };
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    const initial = createInitialState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (!Array.isArray(parsed.feed) || !parsed.feed.every(isFeedItem)) {
      const initial = createInitialState();
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    if ((parsed.feedVersion ?? 1) < FEED_STATE_VERSION) {
      const initial = createInitialState();
      initial.totalUpgrades = Math.max(
        BASE_TOTAL_UPGRADES,
        Math.floor(parsed.totalUpgrades ?? BASE_TOTAL_UPGRADES),
      );
      initial.playersOnline = Math.max(
        480,
        Math.min(820, Math.floor(parsed.playersOnline ?? 650)),
      );
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    return {
      feedVersion: FEED_STATE_VERSION,
      feed: parsed.feed.slice(0, 40).map(enrichFeedItem),
      totalUpgrades: Math.max(BASE_TOTAL_UPGRADES, Math.floor(parsed.totalUpgrades ?? BASE_TOTAL_UPGRADES)),
      playersOnline: Math.max(480, Math.min(820, Math.floor(parsed.playersOnline ?? 650))),
      registeredUsersDrift: Math.max(0, Math.floor(parsed.registeredUsersDrift ?? 0)),
      updatedAt: parsed.updatedAt ?? Date.now(),
    };
  } catch {
    const initial = createInitialState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function saveState(state) {
  const next = {
    feedVersion: FEED_STATE_VERSION,
    feed: state.feed.slice(0, 40),
    totalUpgrades: Math.max(BASE_TOTAL_UPGRADES, Math.floor(state.totalUpgrades)),
    playersOnline: Math.max(480, Math.min(820, Math.floor(state.playersOnline))),
    registeredUsersDrift: Math.max(0, Math.floor(state.registeredUsersDrift ?? 0)),
    updatedAt: Date.now(),
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function appendFeedItem(state, item) {
  const enriched = enrichFeedItem(item);
  return {
    ...state,
    feed: [enriched, ...state.feed.filter(existing => existing.id !== enriched.id)].slice(0, 40),
    totalUpgrades: state.totalUpgrades + 1,
    updatedAt: Date.now(),
  };
}

function driftPlayersOnline(current) {
  const delta = Math.floor(Math.random() * 17) - 8;
  return Math.max(480, Math.min(820, current + delta));
}

let registeredCountCache = { count: 0, at: 0 };

async function refreshRegisteredUserCount(force = false) {
  if (!force && Date.now() - registeredCountCache.at < 120_000 && registeredCountCache.count > 0) {
    return registeredCountCache.count;
  }
  try {
    const dbCount = await Promise.race([
      userStore.countAccounts(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('user count timeout')), 5000)),
    ]);
    const next = Math.max(0, Math.floor(Number(dbCount) || 0));
    if (next > 0 || registeredCountCache.count === 0) {
      registeredCountCache = { count: next, at: Date.now() };
    } else {
      registeredCountCache = { ...registeredCountCache, at: Date.now() };
    }
  } catch (error) {
    console.warn('[site-state] user count failed:', error instanceof Error ? error.message : error);
  }
  return registeredCountCache.count;
}

async function buildPublicSiteState() {
  const state = loadState();
  const dbCount = await refreshRegisteredUserCount(false);
  return {
    feed: state.feed,
    totalUpgrades: state.totalUpgrades,
    playersOnline: state.playersOnline,
    registeredUsers: dbCount,
    updatedAt: state.updatedAt,
  };
}

function ticketPath(id) {
  return path.join(CHATS_DIR, `${id}.json`);
}

function loadBundleSync(id) {
  const file = ticketPath(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function saveBundleSync(bundle) {
  fs.writeFileSync(ticketPath(bundle.ticket.id), JSON.stringify(bundle, null, 2), 'utf8');
}

function listTicketsSync(filter) {
  const files = fs.readdirSync(CHATS_DIR).filter(f => f.endsWith('.json'));
  const tickets = [];
  for (const file of files) {
    try {
      const bundle = JSON.parse(fs.readFileSync(path.join(CHATS_DIR, file), 'utf8'));
      if (!bundle?.ticket) continue;
      if (filter?.userId && bundle.ticket.userId !== filter.userId) continue;
      if (filter?.openOnly && bundle.ticket.status !== 'open') continue;
      tickets.push(bundle.ticket);
    } catch {
      /* skip corrupt file */
    }
  }
  return tickets.sort((a, b) => b.updatedAt - a.updatedAt);
}

function buildAdminInboxSync(lastReadByTicket = {}) {
  const tickets = listTicketsSync({ openOnly: true });
  return tickets.map(ticket => {
    const bundle = loadBundleSync(ticket.id);
    const messages = bundle?.messages ?? [];
    const userMessages = messages.filter(message => message.senderRole === 'user');
    const lastUserMessage = userMessages.length
      ? userMessages.reduce((latest, message) => (
        message.createdAt > latest.createdAt ? message : latest
      ))
      : null;
    const lastUserMessageAt = lastUserMessage?.createdAt ?? 0;
    const storedRead = lastReadByTicket[ticket.id];
    const unreadCount = storedRead === undefined
      ? Math.max(1, userMessages.length)
      : messages.filter(message => message.senderRole === 'user' && message.createdAt > storedRead).length;
    return {
      ticket,
      unreadCount,
      lastUserMessageAt,
      lastUserMessageText: lastUserMessage?.text?.slice(0, 160) ?? null,
      isUnseen: storedRead === undefined,
    };
  });
}

// Legacy sync helpers kept for account reset; runtime routes use chatStore.

function grantsPath(email) {
  return path.join(GRANTS_DIR, `${sanitizeEmail(email)}.json`);
}

function loadGrantStore(email) {
  const normalized = email.trim().toLowerCase();
  const file = grantsPath(normalized);
  if (!fs.existsSync(file)) return { email: normalized, grants: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed?.grants) return { email: normalized, grants: [] };
    return parsed;
  } catch {
    return { email: normalized, grants: [] };
  }
}

function saveGrantStore(store) {
  fs.writeFileSync(grantsPath(store.email), JSON.stringify(store, null, 2), 'utf8');
}

function balanceGrantsPath(email) {
  return path.join(BALANCE_GRANTS_DIR, `${sanitizeEmail(email)}.json`);
}

function loadBalanceGrantStore(email) {
  const normalized = email.trim().toLowerCase();
  const file = balanceGrantsPath(normalized);
  if (!fs.existsSync(file)) return { email: normalized, grants: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed?.grants) return { email: normalized, grants: [] };
    return parsed;
  } catch {
    return { email: normalized, grants: [] };
  }
}

function saveBalanceGrantStore(store) {
  fs.writeFileSync(balanceGrantsPath(store.email), JSON.stringify(store, null, 2), 'utf8');
}

function levelGrantsPath(email) {
  return path.join(LEVEL_GRANTS_DIR, `${sanitizeEmail(email)}.json`);
}

function loadLevelGrantStore(email) {
  const normalized = email.trim().toLowerCase();
  const file = levelGrantsPath(normalized);
  if (!fs.existsSync(file)) return { email: normalized, grants: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed?.grants) return { email: normalized, grants: [] };
    return parsed;
  } catch {
    return { email: normalized, grants: [] };
  }
}

function saveLevelGrantStore(store) {
  fs.writeFileSync(levelGrantsPath(store.email), JSON.stringify(store, null, 2), 'utf8');
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

const BLOCKED_PATH_PREFIXES = [
  '/src',
  '/server',
  '/scripts',
  '/node_modules',
  '/.env',
  '/.git',
  '/user-db',
  '/player-state',
  '/withdraw-chats',
  '/balance-grants',
  '/level-grants',
  '/inventory-grants',
  '/site-state',
  '/backup',
];

app.use((req, res, next) => {
  const lower = req.path.toLowerCase();
  if (
    BLOCKED_PATH_PREFIXES.some(prefix => lower === prefix || lower.startsWith(`${prefix}/`))
    || lower.endsWith('.map')
    || lower.endsWith('.env')
    || lower.includes('/.')
  ) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  next();
});

function appendUserTxtLog(email, line) {
  const filePath = path.join(LOGS_DIR, `${sanitizeEmail(email)}.txt`);
  if (!fs.existsSync(filePath) && line.startsWith('#')) {
    fs.writeFileSync(filePath, `${line}\n`, 'utf8');
  } else if (!fs.existsSync(filePath)) {
    fs.writeFileSync(
      filePath,
      `# Blox Upgrader — ${email}\n# Created: ${new Date().toISOString()}\n\n${line}\n`,
      'utf8',
    );
  } else {
    fs.appendFileSync(filePath, `${line}\n`, 'utf8');
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      userId,
      email,
      passwordHash,
      salt,
      createdAt,
      acceptedAge,
      acceptedTerms,
      nickname,
    } = req.body ?? {};
    if (!userId || !email || !passwordHash || !salt) {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (banStore.isBanned(normalizedEmail)) {
      sendJson(res, 403, { error: 'account_suspended', message: 'Cuenta suspendida.' });
      return;
    }
    const result = await userStore.registerAccount({
      userId,
      email,
      passwordHash,
      salt,
      createdAt,
      acceptedAge,
      acceptedTerms,
      nickname,
      isNewAccount: true,
    });
    if (result?.line) appendUserTxtLog(email, result.line);
    sendJson(res, 200, {
      ok: true,
      user: result?.user ?? null,
      sessionToken: createSessionToken({ userId, email: normalizedEmail }),
    });
  } catch (error) {
    console.error('[auth/register]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/auth/session', async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (banStore.isBanned(normalizedEmail)) {
      sendJson(res, 403, { error: 'account_suspended', message: 'Cuenta suspendida.' });
      return;
    }
    const auth = await Promise.race([
      userStore.authenticateAccount({ email: normalizedEmail, password }),
      new Promise(resolve => setTimeout(() => resolve({ ok: false, notFound: true }), 3000)),
    ]);
    if (auth.notFound) {
      sendJson(res, 404, { ok: false, notFound: true });
      return;
    }
    if (!auth.ok) {
      sendJson(res, 401, { ok: false, error: 'wrong_password' });
      return;
    }
    let playerState = null;
    try {
        playerState = await Promise.race([
        playerStateStore.getPlayerStateByEmail(normalizedEmail),
        new Promise(resolve => setTimeout(() => resolve(null), 1200)),
      ]);
    } catch {
      playerState = null;
    }
    sendJson(res, 200, {
      ok: true,
      user: {
        userId: auth.userId,
        email: auth.email,
        nickname: auth.nickname,
        salt: auth.salt,
      },
      playerState,
      sessionToken: createSessionToken({ userId: auth.userId, email: auth.email }),
    });
  } catch (error) {
    console.error('[auth/session]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, email, nickname } = req.body ?? {};
    if (!userId || !email) {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const session = requireUserSession(req, res, { email: normalizedEmail });
    if (!session) return;
    if (session.userId !== String(userId)) {
      sendJson(res, 403, { error: 'forbidden', message: 'Session mismatch.' });
      return;
    }
    if (banStore.isBanned(normalizedEmail)) {
      sendJson(res, 403, { error: 'account_suspended', message: 'Cuenta suspendida.' });
      return;
    }
    const result = await userStore.touchAccountLogin({ userId, email, nickname });
    if (result?.line) appendUserTxtLog(email, result.line);
    sendJson(res, 200, { ok: true, user: result?.user ?? null });
  } catch (error) {
    console.error('[auth/login]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/users/sync', async (req, res) => {
  try {
    const { userId, email, nickname, isNewAccount } = req.body ?? {};
    if (!userId || !email) {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const session = requireUserSession(req, res, { email: normalizedEmail });
    if (!session) return;
    const user = await userStore.upsertUser({ userId: session.userId, email: normalizedEmail, nickname, isNewAccount });
    sendJson(res, 200, { ok: true, user });
  } catch (error) {
    console.error('[users/sync]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/user-log', async (req, res) => {
  try {
    const { userId, email, line, action, details } = req.body ?? {};
    if (!email || typeof line !== 'string') {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    appendUserTxtLog(email, line);
    const event = await userStore.appendEvent({ userId, email, line, action, details });
    sendJson(res, 200, { ok: true, eventId: event.id });
  } catch (error) {
    console.error('[user-log]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/player-state/sync', async (req, res) => {
  try {
    const { userId, email, balance, inventory, resetAck } = req.body ?? {};
    if (!userId || !email) {
      sendJson(res, 400, { error: 'bad request' });
      return;
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const session = requireUserSession(req, res, { email: normalizedEmail });
    if (!session) return;
    if (banStore.isBanned(normalizedEmail)) {
      sendJson(res, 403, { error: 'account_suspended', message: 'Cuenta suspendida.' });
      return;
    }
    const pendingResetAt = resetMarkerStore.getResetAt(normalizedEmail);

    if (pendingResetAt && Number(resetAck) !== pendingResetAt) {
      const state = await playerStateStore.savePlayerState({
        userId,
        email: normalizedEmail,
        balance: 0,
        inventory: [],
      });
      sendJson(res, 200, { ok: true, forceReset: true, resetAt: pendingResetAt, state });
      return;
    }

    if (pendingResetAt && Number(resetAck) === pendingResetAt) {
      resetMarkerStore.clearReset(normalizedEmail, pendingResetAt);
    }

    let nextBalance = Math.max(0, Math.floor(Number(balance) || 0));
    let nextInventory = Array.isArray(inventory) ? inventory.slice(0, 500) : [];
    const existing = await playerStateStore.getPlayerStateByEmail(normalizedEmail);
    const pendingGrants = loadBalanceGrantStore(normalizedEmail).grants
      .filter(grant => grant.status === 'pending')
      .reduce((sum, grant) => sum + Math.max(0, Math.floor(Number(grant.amount) || 0)), 0);
    const existingBalance = Math.max(0, Math.floor(Number(existing?.balance) || 0));
    const maxAllowed = Math.min(
      MAX_BALANCE_HARD_CAP,
      existingBalance + pendingGrants + MAX_BALANCE_SYNC_INCREASE,
    );
    if (nextBalance > maxAllowed) {
      console.warn(`[security] blocked balance inflate email=${normalizedEmail} from=${existingBalance} to=${nextBalance} max=${maxAllowed}`);
      nextBalance = Math.min(existingBalance, maxAllowed);
    }
    if (nextBalance > MAX_BALANCE_HARD_CAP) nextBalance = MAX_BALANCE_HARD_CAP;

    const state = await playerStateStore.savePlayerState({
      userId,
      email: normalizedEmail,
      balance: nextBalance,
      inventory: nextInventory,
    });
    sendJson(res, 200, { ok: true, state });
  } catch (error) {
    console.error('[player-state/sync]', error);
    sendJson(res, 500, {
      error: 'error',
      message: error instanceof Error ? error.message : (error?.message ?? 'sync failed'),
    });
  }
});

app.get('/api/player-state/reset-pending', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) {
    sendJson(res, 400, { error: 'email required' });
    return;
  }
  sendJson(res, 200, { resetAt: resetMarkerStore.getResetAt(email) });
});

app.get('/api/profile-photo', (req, res) => {
  const userId = String(req.query.userId ?? '').trim();
  if (!userId) {
    sendJson(res, 400, { error: 'userId required' });
    return;
  }
  sendJson(res, 200, { photo: profilePhotoStore.getPhoto(userId) });
});

app.post('/api/profile-photo', (req, res) => {
  const { userId, email, dataUrl } = req.body ?? {};
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!requireUserSession(req, res, { email: normalizedEmail })) return;
  const result = profilePhotoStore.savePhoto({ userId, email, dataUrl });
  if (!result.ok) {
    const message = result.error === 'too_large'
      ? 'Image is too large.'
      : result.error === 'invalid_format'
        ? 'JPG or PNG only.'
        : 'Could not save photo.';
    sendJson(res, 400, { ok: false, error: result.error, message });
    return;
  }
  sendJson(res, 200, { ok: true, photo: result.photo });
});

app.get('/api/giveaways', (_req, res) => {
  sendJson(res, 200, giveawayStore.getAll());
});

app.get('/api/giveaways/winners', (req, res) => {
  const limit = Number(req.query.limit ?? 24);
  sendJson(res, 200, giveawayStore.listWinners(Number.isFinite(limit) ? limit : 24));
});

app.get('/api/giveaways/pending-win', (req, res) => {
  const userId = String(req.query.userId ?? '').trim();
  if (!userId) {
    sendJson(res, 400, { error: 'userId required' });
    return;
  }
  sendJson(res, 200, giveawayStore.listPendingWins(userId));
});

app.post('/api/giveaways/pending-win/ack', (req, res) => {
  const userId = String(req.body?.userId ?? '').trim();
  const pendingId = String(req.body?.pendingId ?? '').trim();
  if (!userId || !pendingId) {
    sendJson(res, 400, { error: 'invalid_ack' });
    return;
  }
  const result = giveawayStore.ackPendingWin(userId, pendingId);
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.get('/api/giveaways/:period', (req, res) => {
  const period = req.params.period;
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  const userId = req.query.userId ? String(req.query.userId) : null;
  const detail = giveawayStore.getDetail(period, userId);
  if (detail.error) {
    sendJson(res, 400, { error: detail.error });
    return;
  }
  sendJson(res, 200, detail);
});

app.post('/api/giveaways/join', (req, res) => {
  const { period, userId, email, nickname, avatarId } = req.body ?? {};
  const result = giveawayStore.joinGiveaway(period, { userId, email, nickname, avatarId });
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.post('/api/giveaways/deposit-record', (req, res) => {
  const session = requireUserSession(req, res);
  if (!session) return;
  const { amount, nickname, avatarId } = req.body ?? {};
  const normalizedUserId = session.userId;
  const normalizedAmount = Number(amount);
  if (!normalizedUserId || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    sendJson(res, 400, { error: 'invalid_payload' });
    return;
  }
  const updates = giveawayStore.recordUserDeposit(normalizedUserId, Math.min(normalizedAmount, 50_000), {
    email: session.email,
    nickname,
    avatarId,
  });
  sendJson(res, 200, { ok: true, updates });
});

app.post('/api/admin/giveaways/open', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  const adminEmail = __adminSession.email;
  const { period, skin, depositRequirement } = req.body ?? {};
  const result = giveawayStore.openGiveaway({
    period,
    skin,
    depositRequirement,
    openedBy: adminEmail,
  });
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.post('/api/admin/giveaways/close', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  const adminEmail = __adminSession.email;
  const { period, pickWinner } = req.body ?? {};
  const result = giveawayStore.closeGiveaway({
    period,
    pickWinner: Boolean(pickWinner),
    grantedBy: adminEmail,
  });
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.get('/api/case-battles', (_req, res) => {
  sendJson(res, 200, { battles: caseBattleStore.listLive() });
});

app.get('/api/case-battles/:battleId', (req, res) => {
  const battle = caseBattleStore.getById(req.params.battleId);
  if (!battle) {
    sendJson(res, 404, { error: 'not_found' });
    return;
  }
  sendJson(res, 200, { battle });
});

app.put('/api/case-battles/:battleId', (req, res) => {
  const session = requireUserSession(req, res);
  if (!session) return;
  const battle = req.body?.battle;
  if (!battle?.id || String(battle.id).toLowerCase() !== String(req.params.battleId).toLowerCase()) {
    sendJson(res, 400, { error: 'invalid_battle' });
    return;
  }
  const result = caseBattleStore.upsert(battle);
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.delete('/api/case-battles/:battleId', (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const result = caseBattleStore.remove(req.params.battleId);
  if (result.error) {
    sendJson(res, 404, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.get('/api/account-ban-status', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) {
    sendJson(res, 400, { error: 'email required' });
    return;
  }
  banStore.purgeExpired();
  const ban = banStore.getBan(email);
  if (!ban) {
    sendJson(res, 200, { banned: false });
    return;
  }
  sendJson(res, 200, {
    banned: true,
    bannedAt: ban.bannedAt,
    bannedUntil: ban.bannedUntil,
    reason: ban.reason,
    permanent: ban.permanent,
    days: ban.days,
  });
});

app.post('/api/admin/ban-user', (req, res) => {
  try {
    const __adminSession = requireAdminSession(req, res);
    if (!__adminSession) return;
    const adminEmail = __adminSession.email;
    const { email, days, reason } = req.body ?? {};
    const targetEmail = String(email ?? '').trim().toLowerCase();
    if (!targetEmail) {
      sendJson(res, 400, { error: 'email required' });
      return;
    }
    if (userStore.isAdminEmail(targetEmail)) {
      sendJson(res, 400, { error: 'Cannot ban admin accounts' });
      return;
    }
    const ban = banStore.banUser(targetEmail, {
      bannedBy: String(adminEmail).trim().toLowerCase(),
      days: days == null ? null : Number(days),
      reason,
    });
    sendJson(res, 200, { ok: true, ban });
  } catch (error) {
    console.error('[admin/ban-user]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.post('/api/admin/unban-user', (req, res) => {
  try {
    const __adminSession = requireAdminSession(req, res);
    if (!__adminSession) return;
    const adminEmail = __adminSession.email;
    const { email } = req.body ?? {};
    const targetEmail = String(email ?? '').trim().toLowerCase();
    if (!targetEmail) {
      sendJson(res, 400, { error: 'email required' });
      return;
    }
    const result = banStore.unbanUser(targetEmail);
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    console.error('[admin/unban-user]', error);
    sendJson(res, 500, { error: 'error' });
  }
});

app.get('/api/admin/bans', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  banStore.purgeExpired();
  sendJson(res, 200, { bans: banStore.listActiveBans() });
});

app.get('/api/admin/status', (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const session = verifySessionToken(readSessionTokenFromRequest(req));
  const authed = Boolean(session && session.email === email);
  sendJson(res, 200, {
    isAdmin: authed && adminEmailsStore.isAdminEmail(email),
    isCreator: authed && adminEmailsStore.isCreatorEmail(email),
  });
});

app.get('/api/admin/emails', (req, res) => {
  const __creatorSession = requireCreatorSession(req, res);
  if (!__creatorSession) return;
  sendJson(res, 200, { emails: adminEmailsStore.listAdmins() });
});

app.post('/api/admin/emails/add', (req, res) => {
  try {
    const __creatorSession = requireCreatorSession(req, res);
    if (!__creatorSession) return;
    const creatorEmail = __creatorSession.email;
    const { email } = req.body ?? {};
    const result = adminEmailsStore.addAdmin(
      creatorEmail,
      String(email ?? '').trim(),
    );
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const status = message.includes('creator') ? 403 : 400;
    sendJson(res, status, { error: message });
  }
});

app.post('/api/admin/emails/remove', (req, res) => {
  try {
    const __creatorSession = requireCreatorSession(req, res);
    if (!__creatorSession) return;
    const creatorEmail = __creatorSession.email;
    const { email } = req.body ?? {};
    const result = adminEmailsStore.removeAdmin(
      creatorEmail,
      String(email ?? '').trim(),
    );
    sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const status = message.includes('creator') ? 403 : 400;
    sendJson(res, status, { error: message });
  }
});

app.post('/api/admin/reset-password', async (req, res) => {
  try {
    const __creatorSession = requireCreatorSession(req, res);
    if (!__creatorSession) return;
    const { email, password } = req.body ?? {};
    const targetEmail = String(email ?? '').trim().toLowerCase();
    if (!targetEmail) {
      sendJson(res, 400, { error: 'email required' });
      return;
    }
    const result = await userStore.resetAccountPassword({ email: targetEmail, password });
    if (result.notFound) {
      sendJson(res, 404, { ok: false, notFound: true, error: 'account_not_found' });
      return;
    }
    appendUserTxtLog(
      targetEmail,
      `[${new Date().toLocaleString('en-US', { hour12: false })}] AUTH.password_reset | email=${targetEmail}`,
    );
    sendJson(res, 200, { ok: true, email: result.email, userId: result.userId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error';
    const status = message.includes('6 characters') ? 400 : 500;
    console.error('[admin/reset-password]', error);
    sendJson(res, status, { error: message });
  }
});

app.get('/api/admin/player-state', async (req, res) => {
  try {
    const __adminSession = requireAdminSession(req, res);
    if (!__adminSession) return;
    const email = req.query.email?.trim() ?? '';
    if (!email) {
      sendJson(res, 400, { error: 'email required' });
      return;
    }
    const state = await playerStateStore.getPlayerStateByEmail(email);
    if (!state) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    sendJson(res, 200, { state });
  } catch (error) {
    console.error('[admin/player-state]', error);
    sendJson(res, 500, {
      error: 'error',
      message: error instanceof Error ? error.message : (error?.message ?? 'load failed'),
    });
  }
});

app.post('/api/admin/clear-account', async (req, res) => {
  try {
    const __adminSession = requireAdminSession(req, res);
    if (!__adminSession) return;
    const { email } = req.body ?? {};
    if (!email) {
      sendJson(res, 400, { error: 'email required' });
      return;
    }
    const result = await resetAccountByEmail(email, {
      userStore,
      playerStateStore,
      resetMarkerStore,
      logsDir: LOGS_DIR,
      grantsDir: GRANTS_DIR,
      balanceGrantsDir: BALANCE_GRANTS_DIR,
      chatsDir: CHATS_DIR,
    });
    sendJson(res, 200, result);
  } catch (error) {
    console.error('[admin/clear-account]', error);
    sendJson(res, 500, {
      error: 'error',
      message: error instanceof Error ? error.message : (error?.message ?? 'clear failed'),
    });
  }
});

app.post('/api/admin/reset-all-progress', async (req, res) => {
  try {
    const __adminSession = requireAdminSession(req, res);
    if (!__adminSession) return;

    const registeredEmails = await userStore.listRegisteredEmails();
    const skippedAdmins = [];
    const reset = [];

    for (const email of registeredEmails) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) continue;
      if (userStore.isAdminEmail(normalizedEmail) || playerStateStore.isAdminEmail(normalizedEmail)) {
        skippedAdmins.push(normalizedEmail);
        continue;
      }

      const result = await resetPlayerProgressByEmail(normalizedEmail, {
        playerStateStore,
        resetMarkerStore,
      });
      reset.push(result);
    }

    sendJson(res, 200, {
      ok: true,
      resetCount: reset.length,
      skippedAdminCount: skippedAdmins.length,
      skippedAdmins,
    });
  } catch (error) {
    console.error('[admin/reset-all-progress]', error);
    sendJson(res, 500, {
      error: 'error',
      message: error instanceof Error ? error.message : (error?.message ?? 'reset failed'),
    });
  }
});

app.get('/api/admin/user-db/status', async (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  await refreshStorageStatus();
  const users = await userStore.listUsers();
  const emails = await userStore.listRegisteredEmails();
  const totalAccountRows = typeof userStore.countAccounts === 'function'
    ? await userStore.countAccounts()
    : users.length;
  sendJson(res, 200, {
    storage: storageStatus,
    backend: userStore.type ?? 'file',
    dataDir: userStore.type === 'supabase' ? process.env.SUPABASE_URL : DATA_DIR,
    logsDir: LOGS_DIR,
    userCount: users.length,
    totalAccountRows,
    registeredEmailCount: emails.length,
    registeredEmails: emails,
    siteUrl: SITE_URL,
  });
});

app.get('/api/admin/user-db/users', async (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  sendJson(res, 200, { users: await userStore.listUsers() });
});

app.get('/api/admin/user-db/users/:userId', async (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  const user = await userStore.getUser(req.params.userId);
  if (!user) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  sendJson(res, 200, { user, events: await userStore.getUserEvents(req.params.userId) });
});

app.get('/api/admin/user-db/users/:userId/export.txt', async (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  if (!(await userStore.getUser(req.params.userId))) {
    sendJson(res, 404, { error: 'not found' });
    return;
  }
  res.type('text/plain; charset=utf-8');
  res.send(await userStore.exportUserTxt(req.params.userId));
});

app.get('/api/promo-codes/validate', (req, res) => {
  const code = String(req.query.code ?? '');
  sendJson(res, 200, promoCodeStore.validateCode(code));
});

app.get('/api/admin/promo-codes', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  sendJson(res, 200, { codes: promoCodeStore.listCodes() });
});

app.post('/api/admin/promo-codes', (req, res) => {
  const body = req.body ?? {};
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  body.adminEmail = __adminSession.email;
  const result = promoCodeStore.createCode({
    code: String(body.code ?? ''),
    percent: Number(body.percent),
    durationValue: body.durationValue,
    durationUnit: body.durationUnit ?? 'permanent',
    createdBy: String(body.adminEmail ?? '').trim(),
  });
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, { entry: result.entry });
});

app.delete('/api/admin/promo-codes/:code', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  const result = promoCodeStore.deleteCode(req.params.code ?? '');
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, { ok: true, entry: result.entry });
});

app.get('/api/announcement/active', (_req, res) => {
  sendJson(res, 200, { announcement: announcementStore.getActive() });
});

app.get('/api/admin/announcement', (req, res) => {
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  sendJson(res, 200, { announcement: announcementStore.getActive() });
});

app.post('/api/admin/announcement', (req, res) => {
  const body = req.body ?? {};
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  body.adminEmail = __adminSession.email;
  const result = announcementStore.publish({
    title: body.title,
    message: body.message,
    createdBy: body.adminEmail,
  });
  if (result.error) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, result);
});

app.post('/api/admin/announcement/clear', (req, res) => {
  const body = req.body ?? {};
  const __adminSession = requireAdminSession(req, res);
  if (!__adminSession) return;
  body.adminEmail = __adminSession.email;
  sendJson(res, 200, announcementStore.clear());
});

app.get('/api/site-state', async (_req, res) => {
  try {
    sendJson(res, 200, await buildPublicSiteState());
  } catch (error) {
    console.error('[site-state]', error);
    sendJson(res, 500, { error: 'server error' });
  }
});

app.post('/api/site-state/feed-event', async (req, res) => {
  const session = requireUserSession(req, res);
  if (!session) return;
  const body = req.body;
  if (!isFeedItem(body)) {
    sendJson(res, 400, { error: 'invalid feed item' });
    return;
  }
  saveState(appendFeedItem(loadState(), {
    ...body,
    username: session.email.split('@')[0],
  }));
  try {
    sendJson(res, 200, await buildPublicSiteState());
  } catch (error) {
    console.error('[site-state/feed-event]', error);
    sendJson(res, 500, { error: 'server error' });
  }
});

app.get('/api/inventory-grants', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) {
    sendJson(res, 400, { error: 'email required' });
    return;
  }
  const store = loadGrantStore(email);
  sendJson(res, 200, { grants: store.grants.filter(g => g.status === 'pending') });
});

app.post('/api/inventory-grants/ack', (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  const grantIds = req.body?.grantIds;
  if (!email || !Array.isArray(grantIds)) {
    sendJson(res, 400, { error: 'invalid ack' });
    return;
  }
  if (!requireUserSession(req, res, { email })) return;
  const store = loadGrantStore(email);
  const ids = new Set(grantIds);
  store.grants = store.grants.map(g => (ids.has(g.id) ? { ...g, status: 'applied' } : g));
  saveGrantStore(store);
  sendJson(res, 200, { ok: true });
});

app.post('/api/inventory-grants', (req, res) => {
  const adminSession = requireAdminSession(req, res);
  if (!adminSession) return;
  const targetEmail = req.body?.targetEmail?.trim().toLowerCase();
  const grantedBy = adminSession.email;
  const skin = req.body?.skin;
  if (!targetEmail || !skin?.id) {
    sendJson(res, 400, { error: 'invalid grant' });
    return;
  }
  const quantity = Math.min(99, Math.max(1, Math.floor(req.body?.quantity ?? 1)));
  const store = loadGrantStore(targetEmail);
  const now = Date.now();
  const grants = Array.from({ length: quantity }, (_, index) => ({
    id: `grant_${now}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    targetEmail,
    grantedBy,
    skin,
    createdAt: now + index,
    status: 'pending',
  }));
  store.grants.push(...grants);
  saveGrantStore(store);
  sendJson(res, 200, { grants, quantity });
});

app.get('/api/balance-grants', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) {
    sendJson(res, 400, { error: 'email required' });
    return;
  }
  const store = loadBalanceGrantStore(email);
  sendJson(res, 200, { grants: store.grants.filter(g => g.status === 'pending') });
});

app.post('/api/balance-grants/ack', (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  const grantIds = req.body?.grantIds;
  if (!email || !Array.isArray(grantIds)) {
    sendJson(res, 400, { error: 'invalid ack' });
    return;
  }
  if (!requireUserSession(req, res, { email })) return;
  const store = loadBalanceGrantStore(email);
  const ids = new Set(grantIds);
  store.grants = store.grants.map(g => (ids.has(g.id) ? { ...g, status: 'applied' } : g));
  saveBalanceGrantStore(store);
  sendJson(res, 200, { ok: true });
});

app.post('/api/balance-grants', (req, res) => {
  const adminSession = requireAdminSession(req, res);
  if (!adminSession) return;
  const targetEmail = req.body?.targetEmail?.trim().toLowerCase();
  const grantedBy = adminSession.email;
  const amount = Number(req.body?.amount);
  if (!targetEmail || !Number.isFinite(amount) || amount <= 0) {
    sendJson(res, 400, { error: 'invalid grant' });
    return;
  }
  const store = loadBalanceGrantStore(targetEmail);
  const now = Date.now();
  const grant = {
    id: `bal_${now}_${Math.random().toString(36).slice(2, 8)}`,
    targetEmail,
    grantedBy,
    amount: Math.floor(amount),
    createdAt: now,
    status: 'pending',
  };
  store.grants.push(grant);
  saveBalanceGrantStore(store);
  sendJson(res, 200, { grant });
});

const MAX_LEVEL_GRANT = 90;

app.get('/api/level-grants', (req, res) => {
  const email = req.query.email?.trim().toLowerCase();
  if (!email) {
    sendJson(res, 400, { error: 'email required' });
    return;
  }
  const store = loadLevelGrantStore(email);
  sendJson(res, 200, { grants: store.grants.filter(g => g.status === 'pending') });
});

app.post('/api/level-grants/ack', (req, res) => {
  const email = req.body?.email?.trim().toLowerCase();
  const grantIds = req.body?.grantIds;
  if (!email || !Array.isArray(grantIds)) {
    sendJson(res, 400, { error: 'invalid ack' });
    return;
  }
  if (!requireUserSession(req, res, { email })) return;
  const store = loadLevelGrantStore(email);
  const ids = new Set(grantIds);
  store.grants = store.grants.map(g => (ids.has(g.id) ? { ...g, status: 'applied' } : g));
  saveLevelGrantStore(store);
  sendJson(res, 200, { ok: true });
});

app.post('/api/level-grants', (req, res) => {
  const adminSession = requireAdminSession(req, res);
  if (!adminSession) return;
  const targetEmail = req.body?.targetEmail?.trim().toLowerCase();
  const grantedBy = adminSession.email;
  const level = Math.floor(Number(req.body?.level));
  if (
    !targetEmail
    || !Number.isFinite(level)
    || level < 1
    || level > MAX_LEVEL_GRANT
  ) {
    sendJson(res, 400, { error: 'invalid grant' });
    return;
  }
  const store = loadLevelGrantStore(targetEmail);
  const now = Date.now();
  const grant = {
    id: `lvl_${now}_${Math.random().toString(36).slice(2, 8)}`,
    targetEmail,
    grantedBy,
    level,
    createdAt: now,
    status: 'pending',
  };
  store.grants.push(grant);
  saveLevelGrantStore(store);
  sendJson(res, 200, { grant });
});

app.get('/api/withdraw/tickets', async (req, res) => {
  const userId = req.query.userId;
  const adminRequested = req.query.admin === '1';
  const all = req.query.all === '1';
  try {
    let tickets;
    if (adminRequested) {
      const adminSession = requireAdminSession(req, res);
      if (!adminSession) return;
      tickets = await withdrawChatStore.listTickets(all ? undefined : { openOnly: true });
    } else {
      tickets = await withdrawChatStore.listTickets(userId ? { userId } : undefined);
    }
    sendJson(res, 200, { tickets });
  } catch (error) {
    console.error('[withdraw-chat] list tickets failed:', error);
    sendJson(res, 500, { error: 'failed to list tickets' });
  }
});

app.post('/api/withdraw/admin-inbox', async (req, res) => {
  if (!requireAdminSession(req, res)) return;
  const lastReadByTicket = req.body?.lastReadByTicket ?? {};
  try {
    const items = await withdrawChatStore.buildAdminInbox(lastReadByTicket);
    sendJson(res, 200, { items });
  } catch (error) {
    console.error('[withdraw-chat] admin inbox failed:', error);
    sendJson(res, 500, { error: 'failed to load inbox' });
  }
});

app.get('/api/withdraw/tickets/:ticketId', async (req, res) => {
  try {
    const bundle = await withdrawChatStore.loadBundle(req.params.ticketId);
    if (!bundle) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    sendJson(res, 200, bundle);
  } catch (error) {
    console.error('[withdraw-chat] load ticket failed:', error);
    sendJson(res, 500, { error: 'failed to load ticket' });
  }
});

app.post('/api/withdraw/tickets/:ticketId/messages', async (req, res) => {
  try {
    const session = requireUserSession(req, res);
    if (!session) return;
    const bundle = await withdrawChatStore.loadBundle(req.params.ticketId);
    if (!bundle) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    const body = req.body ?? {};
    if (!body.text?.trim()) {
      sendJson(res, 400, { error: 'empty message' });
      return;
    }

    const ticketOwnerId = String(bundle.ticket?.userId ?? '');
    const isAdminSender = adminEmailsStore.isAdminEmail(session.email);
    if (!isAdminSender && ticketOwnerId && ticketOwnerId !== session.userId) {
      sendJson(res, 403, { error: 'forbidden', message: 'Not your ticket.' });
      return;
    }

    const now = Date.now();
    const displayName = String(body.senderLabel || session.email.split('@')[0] || 'User').slice(0, 64);
    bundle.messages.push({
      id: `msg_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ticketId: req.params.ticketId,
      senderId: session.userId,
      senderEmail: session.email,
      // Never trust client-provided role — DevTools spoofing.
      senderRole: isAdminSender ? 'admin' : 'user',
      senderLabel: isAdminSender ? 'Admin' : displayName,
      text: String(body.text).trim().slice(0, 4000),
      createdAt: now,
    });
    bundle.ticket.updatedAt = now;
    await withdrawChatStore.saveBundle(bundle);
    sendJson(res, 200, bundle);
  } catch (error) {
    console.error('[withdraw-chat] send message failed:', error);
    sendJson(res, 500, { error: 'failed to send message' });
  }
});

app.patch('/api/withdraw/tickets/:ticketId', async (req, res) => {
  try {
    if (!requireAdminSession(req, res)) return;
    const bundle = await withdrawChatStore.loadBundle(req.params.ticketId);
    if (!bundle) {
      sendJson(res, 404, { error: 'not found' });
      return;
    }
    const status = req.body?.status;
    if (!['open', 'completed', 'cancelled'].includes(status)) {
      sendJson(res, 400, { error: 'invalid status' });
      return;
    }
    const now = Date.now();
    bundle.ticket.status = status;
    bundle.ticket.updatedAt = now;
    const ticketType = bundle.ticket.type ?? 'withdraw';
    const statusText = status === 'completed'
      ? ticketType === 'deposit'
        ? 'Deposit completed. The amount has been added to your SALDO.'
        : ticketType === 'help'
          ? 'Support chat closed. Thanks for contacting us.'
          : 'Withdrawal completed. The selected skins have been removed from your inventory.'
      : status === 'cancelled'
        ? ticketType === 'deposit'
          ? 'Deposit request cancelled.'
          : ticketType === 'help'
            ? 'Support chat cancelled.'
            : 'Withdrawal request cancelled. Your skins remain in your inventory.'
        : 'Request reopened.';
    bundle.messages.push({
      id: `msg_${now}_sys`,
      ticketId: req.params.ticketId,
      senderId: 'system',
      senderEmail: 'system@blox-upgrader',
      senderRole: 'system',
      senderLabel: 'System',
      text: statusText,
      createdAt: now,
    });
    await withdrawChatStore.saveBundle(bundle);
    if (status === 'completed' && ticketType === 'deposit') {
      recordGiveawayDepositFromTicket(giveawayStore, bundle.ticket);
    }
    sendJson(res, 200, bundle);
  } catch (error) {
    console.error('[withdraw-chat] update ticket failed:', error);
    sendJson(res, 500, { error: 'failed to update ticket' });
  }
});

app.post('/api/withdraw/tickets', async (req, res) => {
  const body = req.body ?? {};
  if (!body.userId) {
    sendJson(res, 400, { error: 'invalid ticket' });
    return;
  }

  const now = Date.now();
  const ticketType = body.type ?? 'withdraw';

  if (ticketType === 'deposit') {
    if (body.depositMethod === 'robux') {
      const robuxAmount = Number(body.robuxAmount);
      const bonusResult = resolveRobuxDepositBonus(body, robuxAmount);
      if (bonusResult.error) {
        sendJson(res, 400, { error: bonusResult.error });
        return;
      }
      const ticketId = `rb_${now}_${Math.random().toString(36).slice(2, 8)}`;
      const creditTotal = bonusResult.creditTotal;
      const ticket = {
        id: ticketId,
        userId: body.userId,
        userEmail: body.userEmail,
        userLabel: body.userLabel || body.userEmail,
        type: 'deposit',
        skins: [],
        total: creditTotal,
        robuxAmount,
        creditTotal,
        ...(bonusResult.bonusCode
          ? {
            bonusCode: bonusResult.bonusCode,
            bonusPercent: bonusResult.bonusPercent,
          }
          : {}),
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      const bonusLine = bonusResult.bonusCode
        ? `\nPromo code ${bonusResult.bonusCode} (+${bonusResult.bonusPercent}%): ${creditTotal.toLocaleString('en-US')} coins SALDO.`
        : `\nYou will receive ${creditTotal.toLocaleString('en-US')} coins SALDO (1 R$ = 1.2 coins).`;
      const bundle = {
        ticket,
        messages: [{
          id: `msg_${now}_welcome`,
          ticketId,
          senderId: 'system',
          senderEmail: 'system@blox-upgrader',
          senderRole: 'system',
          senderLabel: 'System',
          text: `Robux deposit request received (${robuxAmount.toLocaleString('en-US')} R$).${bonusLine}\n\nAn administrator will assist you live. Follow their payment instructions here.`,
          createdAt: now,
        }],
      };
      await withdrawChatStore.saveBundle(bundle);
      sendJson(res, 200, bundle);
      return;
    }

    const skins = body.skins ?? [];
    const total = skins.reduce((sum, s) => sum + s.price, 0);
    if (!skins.length || !Number.isFinite(total) || total < MIN_DEPOSIT_TOTAL) {
      sendJson(res, 400, { error: 'invalid deposit' });
      return;
    }
    const bonusResult = resolveDepositBonus(body, total);
    if (bonusResult.error) {
      sendJson(res, 400, { error: bonusResult.error });
      return;
    }
    const ticketId = `dp_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const ticket = {
      id: ticketId,
      userId: body.userId,
      userEmail: body.userEmail,
      userLabel: body.userLabel || body.userEmail,
      type: 'deposit',
      skins,
      total,
      ...(bonusResult.bonusCode
        ? {
          creditTotal: bonusResult.creditTotal,
          bonusCode: bonusResult.bonusCode,
          bonusPercent: bonusResult.bonusPercent,
        }
        : {}),
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    const grouped = new Map();
    for (const skin of skins) {
      const existing = grouped.get(skin.id);
      if (existing) existing.qty += 1;
      else grouped.set(skin.id, { name: skin.name, price: skin.price, qty: 1 });
    }
    const skinList = Array.from(grouped.values())
      .map(s => `• ${s.qty > 1 ? `${s.qty}× ` : ''}${s.name} (${(s.price * s.qty).toLocaleString('es-ES')})`)
      .join('\n');
    const creditLine = bonusResult.bonusCode
      ? `${total.toLocaleString('es-ES')} coins + ${bonusResult.bonusPercent}% bonus = ${bonusResult.creditTotal.toLocaleString('es-ES')} coins credit`
      : `${total.toLocaleString('es-ES')} coins`;
    const bundle = {
      ticket,
      messages: [{
        id: `msg_${now}_welcome`,
        ticketId,
        senderId: 'system',
        senderEmail: 'system@blox-upgrader',
        senderRole: 'system',
        senderLabel: 'System',
        text: `Deposit request received (${creditLine}).\n\n${skinList}\n\nAn administrator will assist you live. Follow their payment instructions here.`,
        createdAt: now,
      }],
    };
    await withdrawChatStore.saveBundle(bundle);
    sendJson(res, 200, bundle);
    return;
  }

  if (ticketType === 'help') {
    const ticketId = `hp_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const ticket = {
      id: ticketId,
      userId: body.userId,
      userEmail: body.userEmail,
      userLabel: body.userLabel || body.userEmail,
      type: 'help',
      skins: [],
      total: 0,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    };
    const bundle = {
      ticket,
      messages: [{
        id: `msg_${now}_welcome`,
        ticketId,
        senderId: 'system',
        senderEmail: 'system@blox-upgrader',
        senderRole: 'system',
        senderLabel: 'System',
        text: 'Welcome to live support. An administrator will assist you shortly. Describe your question here.',
        createdAt: now,
      }],
    };
    await withdrawChatStore.saveBundle(bundle);
    sendJson(res, 200, bundle);
    return;
  }

  if (!body.skins?.length) {
    sendJson(res, 400, { error: 'invalid ticket' });
    return;
  }

  const ticketId = `wd_${now}_${Math.random().toString(36).slice(2, 8)}`;
  const total = body.skins.reduce((sum, s) => sum + s.price, 0);
  if (total < MIN_WITHDRAW_TOTAL) {
    sendJson(res, 400, { error: `Minimum withdrawal is ${MIN_WITHDRAW_TOTAL} coins total.` });
    return;
  }
  const ticket = {
    id: ticketId,
    userId: body.userId,
    userEmail: body.userEmail,
    userLabel: body.userLabel || body.userEmail,
    type: 'withdraw',
    skins: body.skins,
    total,
    status: 'open',
    createdAt: now,
    updatedAt: now,
  };
  const skinList = body.skins.map(s => `• ${s.name} (${s.price.toLocaleString('es-ES')})`).join('\n');
  const bundle = {
    ticket,
    messages: [{
      id: `msg_${now}_welcome`,
      ticketId,
      senderId: 'system',
      senderEmail: 'system@blox-upgrader',
      senderRole: 'system',
      senderLabel: 'System',
      text: `Withdraw request received (${body.skins.length} skins · ${total.toLocaleString('es-ES')}).\n\n${skinList}\n\nAn administrator will assist you live. Please follow their instructions here.`,
      createdAt: now,
    }],
  };
  await withdrawChatStore.saveBundle(bundle);
  sendJson(res, 200, bundle);
});

if (!fs.existsSync(DIST)) {
  console.error('[Blox Upgrader] Run "npm run build" before "npm start".');
  process.exit(1);
}

app.use('/assets', express.static(path.join(DIST, 'assets'), {
  maxAge: '1y',
  immutable: true,
  index: false,
  dotfiles: 'deny',
  setHeaders(res, filePath) {
    if (String(filePath).endsWith('.map')) {
      res.statusCode = 404;
    }
  },
}));

app.use(express.static(DIST, {
  index: false,
  maxAge: '1h',
  dotfiles: 'deny',
  setHeaders(res, filePath) {
    if (String(filePath).endsWith('.map')) {
      res.statusCode = 404;
    }
  },
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(DIST, 'index.html'));
});

app.use('/api/*', (_req, res) => {
  sendJson(res, 404, { error: 'not found' });
});

setInterval(() => {
  try {
    const state = loadState();
    const next = appendFeedItem(state, createBotFeedItem());
    saveState({
      ...next,
      playersOnline: driftPlayersOnline(state.playersOnline),
    });
  } catch {
    /* ignore bot tick errors */
  }
}, 3500);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BloxUpgrader.com] listening on 0.0.0.0:${PORT} ${SITE_URL}`);
  void refreshRegisteredUserCount(true).then((count) => {
    console.log(`[site-state] registered users=${count}`);
  }).catch(() => {});
  void refreshStorageStatus().then(() => {
    console.log(`[UserDB] backend=${userStore.type ?? 'file'} path=${storageStatus.path}`);
    console.log(`[UserDB] storage ${storageStatus.ok ? 'OK' : 'FAILED'}${storageStatus.error ? `: ${storageStatus.error}` : ''}`);
  }).catch((error) => {
    console.error('[UserDB] status check failed', error instanceof Error ? error.message : error);
  });
});
