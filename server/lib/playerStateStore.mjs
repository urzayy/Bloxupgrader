import fs from 'node:fs';
import path from 'node:path';
import { createTimedSupabase } from './supabaseEnv.mjs';
import { createAdminEmailsStore } from './adminEmailsStore.mjs';
import { preferLocalFileStore } from './localFilePrefer.mjs';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function sanitizeEmail(email) {
  return normalizeEmail(email).replace(/@/g, '_at_').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function isSkin(value) {
  return (
    value
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.weapon === 'string'
    && typeof value.rarity === 'string'
    && typeof value.wear === 'string'
    && typeof value.price === 'number'
    && typeof value.image === 'string'
  );
}

function normalizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSkin).slice(0, 500);
}

function normalizeBalance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

function rowToState(row) {
  if (!row) return null;
  return {
    userId: row.id ?? row.user_id ?? null,
    email: normalizeEmail(row.email),
    balance: normalizeBalance(row.balance),
    inventory: normalizeInventory(row.inventory),
    updatedAt: Number(row.inventory_updated_at ?? row.updated_at ?? 0),
  };
}

export function createFilePlayerStateStore(rootDir, adminEmailsStore) {
  if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });

  const filePath = (email) => path.join(rootDir, `${sanitizeEmail(email)}.json`);

  function readState(email) {
    const file = filePath(email);
    if (!fs.existsSync(file)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        userId: typeof parsed.userId === 'string' ? parsed.userId : null,
        email: normalizeEmail(parsed.email ?? email),
        balance: normalizeBalance(parsed.balance),
        inventory: normalizeInventory(parsed.inventory),
        updatedAt: Number(parsed.updatedAt ?? 0),
      };
    } catch {
      return null;
    }
  }

  return {
    type: 'file',
    async savePlayerState({ userId, email, balance, inventory }) {
      const normalizedEmail = normalizeEmail(email);
      const payload = {
        userId,
        email: normalizedEmail,
        balance: normalizeBalance(balance),
        inventory: normalizeInventory(inventory),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(filePath(normalizedEmail), JSON.stringify(payload, null, 2), 'utf8');
      return payload;
    },
    async getPlayerStateByEmail(email) {
      return readState(normalizeEmail(email));
    },
    async clearByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      const emptyState = {
        userId: null,
        email: normalizedEmail,
        balance: 0,
        inventory: [],
        updatedAt: Date.now(),
      };
      fs.writeFileSync(filePath(normalizedEmail), JSON.stringify(emptyState, null, 2), 'utf8');
      return emptyState;
    },
    async clearAllBalances() {
      const ts = Date.now();
      let cleared = 0;
      if (!fs.existsSync(rootDir)) return { cleared, updatedAt: ts };
      for (const file of fs.readdirSync(rootDir).filter(name => name.endsWith('.json'))) {
        try {
          const full = path.join(rootDir, file);
          const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
          const email = normalizeEmail(parsed?.email ?? '');
          const emptyState = {
            userId: typeof parsed?.userId === 'string' ? parsed.userId : null,
            email,
            balance: 0,
            inventory: [],
            updatedAt: ts,
          };
          fs.writeFileSync(full, JSON.stringify(emptyState, null, 2), 'utf8');
          cleared += 1;
        } catch {
          /* skip corrupt */
        }
      }
      return { cleared, updatedAt: ts };
    },
    isAdminEmail(email) {
      return adminEmailsStore.isAdminEmail(email);
    },
  };
}

export function createSupabasePlayerStateStore(url, secretKey, adminEmailsStore) {
  const supabase = createTimedSupabase(url, secretKey);

  async function saveToAccounts({ userId, email, balance, inventory }) {
    const normalizedEmail = normalizeEmail(email);
    const ts = Date.now();
    const patch = {
      balance: normalizeBalance(balance),
      inventory: normalizeInventory(inventory),
      inventory_updated_at: ts,
      last_seen_at: ts,
    };

    const { data: existing } = await supabase
      .from('blox_accounts')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('blox_accounts')
        .update(patch)
        .eq('email', normalizedEmail)
        .select('id, email, balance, inventory, inventory_updated_at')
        .single();
      if (error) throw error;
      return rowToState(data);
    }

    const { data, error } = await supabase
      .from('blox_accounts')
      .upsert({
        id: userId,
        email: normalizedEmail,
        created_at: ts,
        last_seen_at: ts,
        event_count: 0,
        ...patch,
      }, { onConflict: 'id' })
      .select('id, email, balance, inventory, inventory_updated_at')
      .single();
    if (error) throw error;
    return rowToState(data);
  }

  async function readFromAccounts(email) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from('blox_accounts')
      .select('id, email, balance, inventory, inventory_updated_at')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const state = rowToState(data);
    if (!state?.updatedAt) return null;
    return state;
  }

  return {
    type: 'supabase',
    savePlayerState: saveToAccounts,
    getPlayerStateByEmail: readFromAccounts,
    async clearByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      const ts = Date.now();
      const { data: existing } = await supabase
        .from('blox_accounts')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('blox_accounts')
          .update({
            balance: 0,
            inventory: [],
            inventory_updated_at: ts,
          })
          .eq('email', normalizedEmail);
        if (error) throw error;
        return {
          userId: existing.id,
          email: normalizedEmail,
          balance: 0,
          inventory: [],
          updatedAt: ts,
        };
      }

      return {
        userId: null,
        email: normalizedEmail,
        balance: 0,
        inventory: [],
        updatedAt: ts,
      };
    },
    async clearAllBalances() {
      const ts = Date.now();
      // PostgREST requires a filter; match all known rows by updating where balance/inventory exist.
      const { error, count } = await supabase
        .from('blox_accounts')
        .update({
          balance: 0,
          inventory: [],
          inventory_updated_at: ts,
        }, { count: 'exact' })
        .gte('created_at', 0);
      if (error) throw error;
      return { cleared: count ?? 0, updatedAt: ts };
    },
    isAdminEmail(email) {
      return adminEmailsStore.isAdminEmail(email);
    },
  };
}

function supabaseErrorMessage(error) {
  if (!error) return 'unknown error';
  if (error instanceof Error) return error.message;
  if (typeof error.message === 'string') return error.message;
  return 'database error';
}

export function createHybridPlayerStateStore(fileStore, remoteStore) {
  let remoteCooldownUntil = 0;
  let remoteFailStreak = 0;

  function noteRemoteFail(error) {
    remoteFailStreak += 1;
    const coolMs = Math.min(120_000, 5_000 * remoteFailStreak);
    remoteCooldownUntil = Date.now() + coolMs;
    console.error(
      `[player-state] remote failed, using file for ${Math.round(coolMs / 1000)}s:`,
      supabaseErrorMessage(error),
    );
  }

  function remoteOk() {
    remoteFailStreak = 0;
  }

  return {
    type: remoteStore.type === 'supabase' ? 'hybrid-supabase' : remoteStore.type,
    async savePlayerState(payload) {
      const fileSaved = await fileStore.savePlayerState(payload);
      if (Date.now() >= remoteCooldownUntil) {
        void remoteStore.savePlayerState(payload).then(remoteOk).catch(noteRemoteFail);
      }
      return fileSaved;
    },
    async getPlayerStateByEmail(email) {
      // File-first so local/dev never stalls on a dead remote.
      const local = await fileStore.getPlayerStateByEmail(email);
      if (local || Date.now() < remoteCooldownUntil) return local;

      try {
        const remote = await remoteStore.getPlayerStateByEmail(email);
        remoteOk();
        if (remote) return remote;
      } catch (error) {
        noteRemoteFail(error);
      }
      return local;
    },
    async clearByEmail(email) {
      await fileStore.clearByEmail(email);
      if (Date.now() < remoteCooldownUntil) return;
      try {
        await remoteStore.clearByEmail(email);
        remoteOk();
      } catch (error) {
        noteRemoteFail(error);
      }
    },
    async clearAllBalances() {
      const fileResult = await fileStore.clearAllBalances();
      let remoteResult = { cleared: 0, updatedAt: fileResult.updatedAt };
      if (Date.now() >= remoteCooldownUntil) {
        try {
          remoteResult = await remoteStore.clearAllBalances();
          remoteOk();
        } catch (error) {
          noteRemoteFail(error);
        }
      }
      return {
        cleared: Math.max(fileResult.cleared, remoteResult.cleared),
        fileCleared: fileResult.cleared,
        remoteCleared: remoteResult.cleared,
        updatedAt: Math.max(fileResult.updatedAt, remoteResult.updatedAt),
      };
    },
    isAdminEmail(email) {
      return fileStore.isAdminEmail(email);
    },
  };
}

export function createPlayerStateStore({ playerStateDir, adminEmailsStore }) {
  const resolvedAdminEmailsStore = adminEmailsStore
    ?? createAdminEmailsStore(path.join(path.dirname(playerStateDir), 'site-state'));
  const fileStore = createFilePlayerStateStore(playerStateDir, resolvedAdminEmailsStore);
  const url = process.env.SUPABASE_URL?.trim();
  const secret = (
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || ''
  ).trim();

  if (preferLocalFileStore()) {
    if (url && secret) {
      console.log('[player-state] local file-only (skip Supabase in this environment)');
    }
    return fileStore;
  }

  if (url && secret) {
    return createHybridPlayerStateStore(
      fileStore,
      createSupabasePlayerStateStore(url, secret, resolvedAdminEmailsStore),
    );
  }

  return fileStore;
}
