import { createUserDb } from './userDb.mjs';
import { createSupabaseDb } from './supabaseDb.mjs';
import { createAdminEmailsStore } from './adminEmailsStore.mjs';
import path from 'node:path';

function wrapSync(db, adminEmailsStore) {
  return {
    type: 'file',
    rootDir: db.rootDir,
    checkConnection: async () => {
      try {
        return { ok: true, path: db.rootDir };
      } catch (error) {
        return { ok: false, path: db.rootDir, error: error instanceof Error ? error.message : 'write failed' };
      }
    },
    registerAccount: async (payload) => db.registerAccount(payload),
    touchAccountLogin: async (payload) => db.touchAccountLogin(payload),
    authenticateAccount: async (payload) => db.authenticateAccount(payload),
    emailExistsOnServer: async (email) => db.emailExistsOnServer(email),
    getAccountByEmail: async (email) => db.getAccountByEmail(email),
    upsertUser: async (payload) => db.upsertUser(payload),
    appendEvent: async (payload) => db.appendEvent(payload),
    listUsers: async () => db.listUsers(),
    listRegisteredEmails: async () => db.listRegisteredEmails(),
    countAccounts: async () => db.listUsers().then(users => users.length),
    getUser: async (userId) => db.getUser(userId),
    getUserEvents: async (userId, limit) => db.getUserEvents(userId, limit),
    exportUserTxt: async (userId) => db.exportUserTxt(userId),
    clearUserByEmail: async (email) => db.clearUserByEmail(email),
    resetAccountPassword: async (payload) => db.resetAccountPassword(payload),
    isAdminEmail: (email) => adminEmailsStore.isAdminEmail(email),
    get ADMIN_EMAILS() {
      return adminEmailsStore.listAdmins();
    },
  };
}

function wrapRemote(db, adminEmailsStore) {
  return {
    ...db,
    isAdminEmail: (email) => adminEmailsStore.isAdminEmail(email),
    get ADMIN_EMAILS() {
      return adminEmailsStore.listAdmins();
    },
  };
}

export function createUserStore({ userDbDir, adminEmailsStore }) {
  const resolvedAdminEmailsStore = adminEmailsStore
    ?? createAdminEmailsStore(path.join(path.dirname(userDbDir), 'site-state'));
  const fileStore = wrapSync(createUserDb(userDbDir, resolvedAdminEmailsStore), resolvedAdminEmailsStore);
  const url = process.env.SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  ).trim();

  if (!url || !secret) return fileStore;

  const remoteStore = wrapRemote(createSupabaseDb(url, secret, resolvedAdminEmailsStore), resolvedAdminEmailsStore);
  let usersCache = { at: 0, value: null };

  async function withTimeout(promise, ms, fallback) {
    let timer;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('store timeout')), ms);
        }),
      ]);
    } catch (error) {
      console.error('[user-store] remote failed, using file:', error instanceof Error ? error.message : error);
      return fallback();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return {
    ...fileStore,
    type: 'hybrid-supabase',
    checkConnection: () => withTimeout(remoteStore.checkConnection(), 5000, () => fileStore.checkConnection()),
    registerAccount: async (payload) => {
      const local = await fileStore.registerAccount(payload);
      void remoteStore.registerAccount(payload).catch(() => {});
      return local;
    },
    authenticateAccount: async (payload) => {
      let remote = null;
      try {
        remote = await withTimeout(remoteStore.authenticateAccount(payload), 2500, () => null);
      } catch {
        remote = null;
      }
      if (remote?.ok) return remote;
      const local = await fileStore.authenticateAccount(payload);
      if (local?.ok) return local;
      if (remote?.wrongPassword || local?.wrongPassword) {
        return { ok: false, wrongPassword: true };
      }
      return remote ?? local ?? { ok: false, notFound: true };
    },
    touchAccountLogin: async (payload) => {
      const local = await fileStore.touchAccountLogin(payload);
      void remoteStore.touchAccountLogin(payload).catch(() => {});
      return local;
    },
    emailExistsOnServer: async (email) => {
      const local = await fileStore.emailExistsOnServer(email);
      if (local) return true;
      return withTimeout(remoteStore.emailExistsOnServer(email), 4000, () => false);
    },
    getAccountByEmail: async (email) => {
      const local = await fileStore.getAccountByEmail(email);
      if (local?.passwordHash) return local;
      const remote = await withTimeout(remoteStore.getAccountByEmail(email), 4000, () => null);
      return remote ?? local ?? null;
    },
    upsertUser: async (payload) => {
      const local = await fileStore.upsertUser(payload);
      void remoteStore.upsertUser(payload).catch(() => {});
      return local;
    },
    appendEvent: async (payload) => {
      const local = await fileStore.appendEvent(payload);
      void remoteStore.appendEvent(payload).catch(() => {});
      return local;
    },
    listUsers: async () => {
      if (usersCache.value && Date.now() - usersCache.at < 20_000) return usersCache.value;
      const local = await fileStore.listUsers();
      let remote = [];
      try {
        remote = await withTimeout(remoteStore.listUsers(), local.length ? 800 : 2500, async () => []);
      } catch {
        remote = [];
      }
      const byEmail = new Map();
      for (const user of [...local, ...remote]) {
        if (!user?.email) continue;
        const prev = byEmail.get(user.email);
        if (!prev || Number(user.lastSeenAt || 0) >= Number(prev.lastSeenAt || 0)) {
          byEmail.set(user.email, user);
        }
      }
      const merged = [...byEmail.values()].sort((a, b) => Number(b.lastSeenAt || 0) - Number(a.lastSeenAt || 0));
      usersCache = { at: Date.now(), value: merged };
      return merged;
    },
    listRegisteredEmails: async () => {
      const local = await fileStore.listRegisteredEmails();
      if (local.length) return local;
      return withTimeout(remoteStore.listRegisteredEmails(), 1200, async () => []);
    },
    countAccounts: async () => {
      let remoteCount = 0;
      try {
        const counted = await withTimeout(remoteStore.countAccounts(), 4000, () => null);
        if (typeof counted === 'number' && Number.isFinite(counted)) remoteCount = counted;
      } catch {
        /* file fallback */
      }
      const localCount = (await fileStore.listRegisteredEmails()).length;
      return Math.max(remoteCount, localCount);
    },
    getUser: async (userId) => {
      const local = await fileStore.getUser(userId);
      if (local) return local;
      return withTimeout(remoteStore.getUser(userId), 4000, () => null);
    },
    getUserEvents: async (userId, limit) => {
      const local = await fileStore.getUserEvents(userId, limit);
      let remote = [];
      try {
        remote = await withTimeout(remoteStore.getUserEvents(userId, limit), 2000, async () => []);
      } catch {
        remote = [];
      }
      const byId = new Map();
      for (const event of [...remote, ...local]) {
        const key = event?.id || `${event?.createdAt}:${event?.action}:${event?.line}`;
        if (!byId.has(key)) byId.set(key, event);
      }
      return [...byId.values()]
        .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
        .slice(-(limit || 500));
    },
    exportUserTxt: (userId) => withTimeout(
      remoteStore.exportUserTxt(userId),
      8000,
      () => fileStore.exportUserTxt(userId),
    ),
    clearUserByEmail: async (email) => {
      const local = await fileStore.clearUserByEmail(email);
      try {
        await withTimeout(remoteStore.clearUserByEmail(email), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
    resetAccountPassword: async (payload) => {
      const local = await fileStore.resetAccountPassword(payload);
      try {
        await withTimeout(remoteStore.resetAccountPassword(payload), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
  };
}
