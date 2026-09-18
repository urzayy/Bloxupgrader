import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadSupabaseEnv() {
  for (const name of ['.env', '.env.local']) {
    const file = path.join(PROJECT_ROOT, name);
    if (!fs.existsSync(file)) continue;
    const parsed = dotenv.parse(fs.readFileSync(file));
    for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (parsed[key] != null && !String(process.env[key] || '').trim()) {
        process.env[key] = String(parsed[key]).trim();
      }
    }
  }
}

export function getSupabaseCredentials() {
  loadSupabaseEnv();
  const url = String(process.env.SUPABASE_URL || '').trim();
  const secret = String(
    process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '',
  ).trim();
  if (!url || !secret) return null;
  return { url, secret };
}

export function supabaseFetch(input, init) {
  const timeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS) || 12_000;
  const timeout = AbortSignal.timeout(timeoutMs);
  const signals = [timeout, init?.signal].filter(Boolean);
  const signal = signals.length === 1 ? timeout : AbortSignal.any(signals);
  return fetch(input, { ...init, signal });
}

export function createTimedSupabase(url, secret) {
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: supabaseFetch },
  });
}

export function createServiceSupabase() {
  const creds = getSupabaseCredentials();
  if (!creds) return null;
  return createTimedSupabase(creds.url, creds.secret);
}
