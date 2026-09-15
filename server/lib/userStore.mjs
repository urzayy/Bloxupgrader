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
      try {
        await withTimeout(remoteStore.registerAccount(payload), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
    authenticateAccount: (payload) => withTimeout(
      remoteStore.authenticateAccount(payload),
      6000,
      () => fileStore.authenticateAccount(payload),
    ),
    touchAccountLogin: async (payload) => {
      const local = await fileStore.touchAccountLogin(payload);
      try {
        await withTimeout(remoteStore.touchAccountLogin(payload), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
    emailExistsOnServer: (email) => withTimeout(
      remoteStore.emailExistsOnServer(email),
      4000,
      () => fileStore.emailExistsOnServer(email),
    ),
    getAccountByEmail: (email) => withTimeout(
      remoteStore.getAccountByEmail(email),
      4000,
      () => fileStore.getAccountByEmail(email),
    ),
    upsertUser: async (payload) => {
      const local = await fileStore.upsertUser(payload);
      try {
        await withTimeout(remoteStore.upsertUser(payload), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
    appendEvent: async (payload) => {
      const local = await fileStore.appendEvent(payload);
      try {
        await withTimeout(remoteStore.appendEvent(payload), 8000, async () => local);
      } catch {
        /* keep local */
      }
      return local;
    },
    listUsers: () => withTimeout(remoteStore.listUsers(), 5000, () => fileStore.listUsers()),
    listRegisteredEmails: () => withTimeout(
      remoteStore.listRegisteredEmails(),
      4000,
      () => fileStore.listRegisteredEmails(),
    ),
    countAccounts: () => withTimeout(remoteStore.countAccounts(), 4000, () => fileStore.countAccounts()),
    getUser: (userId) => withTimeout(remoteStore.getUser(userId), 4000, () => fileStore.getUser(userId)),
    getUserEvents: (userId, limit) => withTimeout(
      remoteStore.getUserEvents(userId, limit),
      5000,
      () => fileStore.getUserEvents(userId, limit),
    ),
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
