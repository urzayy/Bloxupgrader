/**
 * Restore BloxUpgrader users, activity and deposit tickets from a
 * PostgreSQL cluster dump (pg_dumpall .backup.gz) into local files
 * and, if SUPABASE_URL + SUPABASE_SECRET_KEY are set, into Supabase.
 *
 * Usage:
 *   node scripts/restore-cluster-backup.mjs [path-to.backup.gz]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local') });

const DUMP = process.argv[2]
  || 'c:\\Users\\hugou\\Downloads\\db_cluster-23-08-2026@09-43-50.backup.gz';
const USER_DB = path.join(ROOT, 'user-db');
const EVENTS_DIR = path.join(USER_DB, 'events');
const CHATS_DIR = path.join(ROOT, 'withdraw-chats');
const BACKUP_DIR = path.join(ROOT, 'backup');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SECRET = (
  process.env.SUPABASE_SECRET_KEY
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || ''
).trim();

function unescapeCopy(value) {
  if (value === '\\N') return null;
  return value.replace(/\\(.)/g, (_, ch) => {
    if (ch === 't') return '\t';
    if (ch === 'n') return '\n';
    if (ch === 'r') return '\r';
    return ch;
  });
}

function parseBool(value) {
  if (value == null) return true;
  return value === 't' || value === 'true' || value === '1';
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sqlString(value) {
  if (value == null) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseSkins(skinsStr, total, count) {
  const raw = String(skinsStr || '').trim();
  if (!raw) return [];
  const items = raw
    .split(/\s*[·•]\s*/)
    .map(part => part.replace(/^\d+\s*[×x]\s*/, '').trim())
    .filter(Boolean);
  const n = items.length || Math.max(1, Number(count) || 1);
  const each = n > 0 ? Number(total || 0) / n : Number(total || 0);
  return items.map((name, index) => {
    const [weapon, rest] = name.includes('|')
      ? name.split('|').map(part => part.trim())
      : [name, ''];
    return {
      id: `restored_${index}_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24)}`,
      name: rest ? `${weapon} | ${rest}` : name,
      price: Number.isFinite(each) ? Math.round(each * 1000) / 1000 : 0,
      weapon: weapon || name,
      image: '',
      wear: 'Factory New',
    };
  });
}

function ticketTypeFromId(ticketId, action) {
  if (String(ticketId).startsWith('rb_') || action.includes('robux')) return 'deposit';
  if (String(ticketId).startsWith('dp_') || action.startsWith('DEPOSIT')) return 'deposit';
  if (String(ticketId).startsWith('wd_') || action.startsWith('WITHDRAW')) return 'withdraw';
  return 'deposit';
}

function parseNumber(value) {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

async function readCopyTables(dumpPath) {
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump not found: ${dumpPath}`);
  }

  const input = fs.createReadStream(dumpPath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  const accounts = [];
  const events = [];
  let current = null;
  let headers = [];

  for await (const line of rl) {
    if (line.startsWith('COPY public.blox_accounts ')) {
      current = 'accounts';
      const match = line.match(/\((.*)\) FROM stdin;/);
      headers = match ? match[1].split(',').map(part => part.trim()) : [];
      continue;
    }
    if (line.startsWith('COPY public.blox_user_events ')) {
      current = 'events';
      const match = line.match(/\((.*)\) FROM stdin;/);
      headers = match ? match[1].split(',').map(part => part.trim()) : [];
      continue;
    }
    if (current && line === '\\.') {
      current = null;
      headers = [];
      continue;
    }
    if (!current) continue;

    const cols = line.split('\t').map(unescapeCopy);
    const row = {};
    headers.forEach((name, index) => {
      row[name] = cols[index] ?? null;
    });
    if (current === 'accounts') accounts.push(row);
    else events.push(row);
  }

  return { accounts, events };
}

function writeLocalFiles(accounts, events) {
  fs.mkdirSync(EVENTS_DIR, { recursive: true });
  fs.mkdirSync(CHATS_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const accountStore = { version: 1, accounts: {}, byEmail: {} };
  const users = { version: 1, users: {} };
  const eventLinesByUser = new Map();
  const tickets = new Map();

  for (const row of accounts) {
    const id = row.id;
    const email = String(row.email || '').trim().toLowerCase();
    if (!id || !email) continue;
    const createdAt = Number(row.created_at) || Date.now();
    const lastSeenAt = Number(row.last_seen_at) || createdAt;
    const lastLoginAt = row.last_login_at != null ? Number(row.last_login_at) : lastSeenAt;
    accountStore.accounts[id] = {
      id,
      email,
      passwordHash: row.password_hash || '',
      salt: row.salt || '',
      nickname: row.nickname || null,
      createdAt,
      acceptedAge: parseBool(row.accepted_age),
      acceptedTerms: parseBool(row.accepted_terms),
      lastLoginAt,
    };
    accountStore.byEmail[email] = id;
    users.users[id] = {
      id,
      email,
      nickname: row.nickname || null,
      createdAt,
      lastSeenAt,
      eventCount: Number(row.event_count) || 0,
      isNewAccount: parseBool(row.is_new_account) && row.is_new_account !== 'f',
    };
  }

  for (const row of events) {
    const userId = row.user_id;
    const email = String(row.email || '').trim().toLowerCase();
    if (!userId) continue;
    const createdAt = Number(row.created_at) || Date.now();
    const details = parseJson(row.details, {});
    const event = {
      id: row.id,
      userId,
      email,
      action: row.action || 'UNKNOWN',
      details,
      line: row.line || '',
      createdAt,
    };
    if (!eventLinesByUser.has(userId)) eventLinesByUser.set(userId, []);
    eventLinesByUser.get(userId).push(`${JSON.stringify(event)}\n`);

    if (!users.users[userId]) {
      users.users[userId] = {
        id: userId,
        email,
        nickname: null,
        createdAt,
        lastSeenAt: createdAt,
        eventCount: 0,
        isNewAccount: false,
      };
    }
    users.users[userId].eventCount = (users.users[userId].eventCount || 0) + 1;
    users.users[userId].lastSeenAt = Math.max(users.users[userId].lastSeenAt || 0, createdAt);

    const action = String(row.action || '');
    const ticketId = details.ticketId;
    if (!ticketId) continue;
    if (!action.startsWith('DEPOSIT.') && !action.startsWith('WITHDRAW.')) continue;

    const existing = tickets.get(ticketId) || {
      ticket: {
        id: ticketId,
        userId,
        userEmail: email,
        userLabel: email.split('@')[0],
        type: ticketTypeFromId(ticketId, action),
        skins: [],
        total: 0,
        status: 'cancelled',
        createdAt,
        updatedAt: createdAt,
      },
      messages: [],
    };

    existing.ticket.userId = userId;
    existing.ticket.userEmail = email;
    existing.ticket.userLabel = users.users[userId]?.nickname || email.split('@')[0];
    existing.ticket.type = ticketTypeFromId(ticketId, action);
    existing.ticket.createdAt = Math.min(existing.ticket.createdAt, createdAt);
    existing.ticket.updatedAt = Math.max(existing.ticket.updatedAt, createdAt);
    existing.ticket.total = parseNumber(details.total) || existing.ticket.total;
    if (details.creditTotal != null) existing.ticket.creditTotal = parseNumber(details.creditTotal);
    if (details.robuxAmount != null) existing.ticket.robuxAmount = parseNumber(details.robuxAmount);
    if (details.skins) {
      existing.ticket.skins = parseSkins(details.skins, existing.ticket.total, details.count);
    }
    if (action.endsWith('.complete')) existing.ticket.status = 'completed';
    else if (action.endsWith('.request') && existing.ticket.status !== 'completed') {
      existing.ticket.status = 'cancelled';
    }
    existing.messages = [{
      id: `msg_${ticketId}_restored`,
      ticketId,
      senderId: userId,
      senderEmail: email,
      senderRole: 'system',
      senderLabel: 'Restore',
      text: row.line || `${action} restored from backup`,
      createdAt,
    }];
    tickets.set(ticketId, existing);
  }

  fs.writeFileSync(path.join(USER_DB, 'accounts.json'), JSON.stringify(accountStore, null, 2));
  fs.writeFileSync(path.join(USER_DB, 'users.json'), JSON.stringify(users, null, 2));

  for (const file of fs.readdirSync(EVENTS_DIR).filter(name => name.endsWith('.jsonl'))) {
    fs.unlinkSync(path.join(EVENTS_DIR, file));
  }
  for (const [userId, lines] of eventLinesByUser) {
    fs.writeFileSync(path.join(EVENTS_DIR, `${userId}.jsonl`), lines.join(''));
  }

  for (const bundle of tickets.values()) {
    fs.writeFileSync(path.join(CHATS_DIR, `${bundle.ticket.id}.json`), JSON.stringify(bundle, null, 2));
  }

  const accountRows = Object.values(accountStore.accounts);
  const sqlChunks = [];
  const batchSize = 200;
  for (let i = 0; i < accountRows.length; i += batchSize) {
    const batch = accountRows.slice(i, i + batchSize);
    const values = batch.map(account => {
      const user = users.users[account.id];
      return `(${[
        sqlString(account.id),
        sqlString(account.email),
        sqlString(account.passwordHash),
        sqlString(account.salt),
        sqlString(account.nickname),
        Number(account.createdAt) || 0,
        Number(user?.lastSeenAt || account.lastLoginAt || account.createdAt) || 0,
        Number(account.lastLoginAt) || 'NULL',
        account.acceptedAge ? 'true' : 'false',
        account.acceptedTerms ? 'true' : 'false',
        Number(user?.eventCount) || 0,
        user?.isNewAccount ? 'true' : 'false',
        'false',
      ].join(', ')})`;
    });
    sqlChunks.push(
      `insert into public.blox_accounts (
  id, email, password_hash, salt, nickname, created_at, last_seen_at, last_login_at,
  accepted_age, accepted_terms, event_count, is_new_account, synced_from_client
) values
${values.join(',\n')}
on conflict (id) do update set
  email = excluded.email,
  password_hash = excluded.password_hash,
  salt = excluded.salt,
  nickname = excluded.nickname,
  last_seen_at = excluded.last_seen_at,
  last_login_at = excluded.last_login_at,
  event_count = excluded.event_count;`,
    );
  }
  fs.writeFileSync(path.join(BACKUP_DIR, 'restore-accounts.sql'), `${sqlChunks.join('\n\n')}\n`);

  return {
    accountCount: accountRows.length,
    eventCount: events.length,
    ticketCount: tickets.size,
    completedDeposits: [...tickets.values()].filter(
      bundle => bundle.ticket.type === 'deposit' && bundle.ticket.status === 'completed',
    ).length,
    tickets,
    accountStore,
    users,
  };
}

async function supabaseRequest(method, table, { query = '', body, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_SECRET,
    Authorization: `Bearer ${SUPABASE_SECRET}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${table} ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function uploadToSupabase(accounts, events, tickets) {
  if (!SUPABASE_URL || !SUPABASE_SECRET) {
    console.log('[restore] No SUPABASE_URL / SUPABASE_SECRET_KEY in .env — skipped remote import.');
    return false;
  }

  console.log(`[restore] Uploading to ${SUPABASE_URL}`);

  const accountPayload = accounts.map(row => ({
    id: row.id,
    email: String(row.email || '').trim().toLowerCase(),
    password_hash: row.password_hash,
    salt: row.salt,
    nickname: row.nickname,
    created_at: Number(row.created_at) || Date.now(),
    last_seen_at: Number(row.last_seen_at) || Number(row.created_at) || Date.now(),
    last_login_at: row.last_login_at != null ? Number(row.last_login_at) : null,
    accepted_age: parseBool(row.accepted_age),
    accepted_terms: parseBool(row.accepted_terms),
    event_count: Number(row.event_count) || 0,
    is_new_account: parseBool(row.is_new_account) && row.is_new_account !== 'f',
    synced_from_client: parseBool(row.synced_from_client) && row.synced_from_client !== 'f',
  })).filter(row => row.id && row.email);

  for (let i = 0; i < accountPayload.length; i += 200) {
    const batch = accountPayload.slice(i, i + 200);
    await supabaseRequest('POST', 'blox_accounts', {
      query: '?on_conflict=id',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    process.stdout.write(`\r[restore] accounts ${Math.min(i + batch.length, accountPayload.length)}/${accountPayload.length}`);
  }
  process.stdout.write('\n');

  const eventPayload = events.map(row => ({
    id: row.id,
    user_id: row.user_id,
    email: String(row.email || '').trim().toLowerCase(),
    action: row.action || 'UNKNOWN',
    details: parseJson(row.details, {}),
    line: row.line || '',
    created_at: Number(row.created_at) || Date.now(),
  })).filter(row => row.id && row.user_id);

  for (let i = 0; i < eventPayload.length; i += 150) {
    const batch = eventPayload.slice(i, i + 150);
    await supabaseRequest('POST', 'blox_user_events', {
      query: '?on_conflict=id',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    if (i % 1500 === 0 || i + 150 >= eventPayload.length) {
      process.stdout.write(`\r[restore] events ${Math.min(i + batch.length, eventPayload.length)}/${eventPayload.length}`);
    }
  }
  process.stdout.write('\n');

  const ticketPayload = [...tickets.values()].map(bundle => ({
    id: bundle.ticket.id,
    user_id: bundle.ticket.userId,
    bundle,
    updated_at: bundle.ticket.updatedAt,
  }));
  for (let i = 0; i < ticketPayload.length; i += 80) {
    const batch = ticketPayload.slice(i, i + 80);
    await supabaseRequest('POST', 'blox_withdraw_chats', {
      query: '?on_conflict=id',
      body: batch,
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    process.stdout.write(`\r[restore] tickets ${Math.min(i + batch.length, ticketPayload.length)}/${ticketPayload.length}`);
  }
  process.stdout.write('\n');

  return true;
}

const { accounts, events } = await readCopyTables(DUMP);
console.log(`[restore] dump accounts=${accounts.length} events=${events.length}`);
const local = writeLocalFiles(accounts, events);
console.log(`[restore] local users=${local.accountCount} events=${local.eventCount} tickets=${local.ticketCount} completedDeposits=${local.completedDeposits}`);
const uploaded = await uploadToSupabase(accounts, events, local.tickets);
console.log(uploaded ? '[restore] Supabase import finished.' : '[restore] Local restore finished. Add SUPABASE keys to .env to upload.');
