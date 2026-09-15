import fs from 'node:fs';
import path from 'node:path';
import { createServiceSupabase } from './supabaseEnv.mjs';

const TABLE = 'blox_json_state';
const FALLBACK_TABLE = 'blox_withdraw_chats';
const FALLBACK_USER = 'json-state';

export function jsonStateFallbackId(key) {
  return `json-state:${String(key || '').trim()}`;
}

export function durableJsonEnabled() {
  if (process.env.DURABLE_JSON === '0') return false;
  if (process.env.DURABLE_JSON === '1') return true;
  return Boolean(createServiceSupabase());
}

function isHollowState(value) {
  if (value == null) return true;
  if (typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length === 0;
  const keys = Object.keys(value);
  if (keys.length === 0) return true;
  if (
    keys.length === 1
    && keys[0] === 'files'
    && value.files
    && typeof value.files === 'object'
    && !Array.isArray(value.files)
    && Object.keys(value.files).length === 0
  ) {
    return true;
  }
  return false;
}

function isSafeRel(name) {
  const rel = String(name || '').replace(/\\/g, '/');
  if (!rel.endsWith('.json')) return false;
  if (rel.includes('..') || rel.startsWith('/') || rel.includes(':')) return false;
  const parts = rel.split('/');
  return parts.length <= 2 && parts.every(part => part && part !== '.' && !part.includes('\\'));
}

export async function loadJsonState(key) {
  const supabase = createServiceSupabase();
  if (!supabase) return null;
  const id = String(key || '').trim();
  if (!id) return null;

  const primary = await supabase.from(TABLE).select('payload').eq('id', id).maybeSingle();
  if (!primary.error && primary.data?.payload != null) return primary.data.payload;

  const fallback = await supabase
    .from(FALLBACK_TABLE)
    .select('bundle')
    .eq('id', jsonStateFallbackId(id))
    .maybeSingle();
  if (!fallback.error && fallback.data?.bundle != null) return fallback.data.bundle;

  if (primary.error && primary.error.code !== 'PGRST116') {
    console.error('[durable-json] load', id, primary.error.message);
  }
  return null;
}

export async function saveJsonState(key, payload) {
  const supabase = createServiceSupabase();
  if (!supabase) return;
  const id = String(key || '').trim();
  if (!id || payload == null) return;
  const now = Date.now();

  const primary = await supabase.from(TABLE).upsert({
    id,
    payload,
    updated_at: now,
  }, { onConflict: 'id' });
  if (!primary.error) return;

  const fallback = await supabase.from(FALLBACK_TABLE).upsert({
    id: jsonStateFallbackId(id),
    user_id: FALLBACK_USER,
    bundle: payload,
    updated_at: now,
  }, { onConflict: 'id' });
  if (fallback.error) {
    console.error('[durable-json] save', id, primary.error?.message || fallback.error.message);
  }
}

export function snapshotJsonDir(dir) {
  const files = {};
  if (!fs.existsSync(dir)) return { files };

  function walk(current, prefix) {
    let names = [];
    try {
      names = fs.readdirSync(current);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          if (!prefix) walk(full, name);
          continue;
        }
        if (!st.isFile() || !isSafeRel(rel)) continue;
        files[rel] = JSON.parse(fs.readFileSync(full, 'utf8'));
      } catch {
        /* skip unreadable entries */
      }
    }
  }

  walk(dir, '');
  return { files };
}

export function restoreJsonDir(dir, payload) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const files = payload?.files && typeof payload.files === 'object' && !Array.isArray(payload.files)
    ? payload.files
    : {};
  const keep = new Set();
  for (const [name, data] of Object.entries(files)) {
    const rel = String(name).replace(/\\/g, '/');
    if (!isSafeRel(rel)) continue;
    keep.add(rel);
    const dest = path.join(dir, ...rel.split('/'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
  }

  function prune(current, prefix) {
    let names = [];
    try {
      names = fs.readdirSync(current);
    } catch {
      return;
    }
    for (const name of names) {
      const full = path.join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          if (!prefix) prune(full, name);
          continue;
        }
        if (st.isFile() && name.endsWith('.json') && !keep.has(rel.replace(/\\/g, '/'))) {
          fs.unlinkSync(full);
        }
      } catch {
        /* ignore */
      }
    }
  }

  prune(dir, '');
}

export function attachDurableJson({ key, fileExisted, getState, setState, writeLocal }) {
  const enabled = durableJsonEnabled();
  const ready = (async () => {
    if (!enabled) return;
    try {
      const remote = await loadJsonState(key);
      if (!isHollowState(remote) && typeof remote === 'object') {
        setState(remote);
        writeLocal(getState());
        return;
      }
      if (fileExisted) await saveJsonState(key, getState());
    } catch (error) {
      console.error('[durable-json] hydrate', key, error instanceof Error ? error.message : error);
    }
  })();

  let timer = 0;
  function persist() {
    const snapshot = getState();
    writeLocal(snapshot);
    if (!enabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = 0;
      void ready.then(() => saveJsonState(key, getState()));
    }, 200);
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  return { persist, ready };
}

function dirHasJson(dir) {
  if (!fs.existsSync(dir)) return false;
  try {
    return Object.keys(snapshotJsonDir(dir).files).length > 0;
  } catch {
    return false;
  }
}

export function attachDurableDir({ key, dir }) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return attachDurableJson({
    key,
    fileExisted: dirHasJson(dir),
    getState: () => snapshotJsonDir(dir),
    setState: (next) => restoreJsonDir(dir, next),
    writeLocal: (payload) => restoreJsonDir(dir, payload),
  });
}
