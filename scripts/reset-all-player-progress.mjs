import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createUserStore } from '../server/lib/userStore.mjs';
import { createPlayerStateStore } from '../server/lib/playerStateStore.mjs';
import { createAccountResetMarkerStore } from '../server/lib/accountResetMarker.mjs';
import { snapshotJsonDir, saveJsonState, durableJsonEnabled } from '../server/lib/durableJsonState.mjs';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || ROOT;
const USER_DB_DIR = process.env.USER_DB_DIR || path.join(DATA_DIR, 'user-db');
const PLAYER_STATE_DIR = process.env.PLAYER_STATE_DIR || path.join(DATA_DIR, 'player-state');
const ACCOUNT_RESETS_DIR = process.env.ACCOUNT_RESETS_DIR || path.join(DATA_DIR, 'account-resets');

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function emailsFromPlayerStateDir(playerStateDir) {
  if (!fs.existsSync(playerStateDir)) return [];

  const emails = [];
  for (const file of fs.readdirSync(playerStateDir).filter(name => name.endsWith('.json'))) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(playerStateDir, file), 'utf8'));
      const email = normalizeEmail(parsed?.email ?? '');
      if (email) emails.push(email);
    } catch {
      /* skip corrupt player-state file */
    }
  }
  return emails;
}

async function main() {
  const userStore = createUserStore({ userDbDir: USER_DB_DIR });
  const playerStateStore = createPlayerStateStore({ playerStateDir: PLAYER_STATE_DIR });
  const resetMarkerStore = createAccountResetMarkerStore(ACCOUNT_RESETS_DIR);

  const registeredEmails = await userStore.listRegisteredEmails();
  const playerStateEmails = emailsFromPlayerStateDir(PLAYER_STATE_DIR);
  const allEmails = [...new Set([...registeredEmails, ...playerStateEmails].map(normalizeEmail))]
    .filter(Boolean)
    .sort();

  // Zero every balance + inventory (admins included), keep accounts/chats intact.
  const clearResult = await playerStateStore.clearAllBalances();

  // Force clients to wipe localStorage XP/level on next sync/poll.
  const resetAt = resetMarkerStore.markGlobalReset();
  for (const email of allEmails) {
    resetMarkerStore.markReset(email);
  }

  if (durableJsonEnabled()) {
    await saveJsonState('account-resets', snapshotJsonDir(ACCOUNT_RESETS_DIR), { force: true });
    await saveJsonState('player-state', snapshotJsonDir(PLAYER_STATE_DIR), { force: true });
  }

  console.log(JSON.stringify({
    ok: true,
    resetAt,
    emailMarkers: allEmails.length,
    balancesCleared: clearResult,
    note: 'Accounts and chats preserved. Balance/inventory/XP reset to 0; clients clear XP via forceReset.',
  }, null, 2));
}

main().catch((error) => {
  console.error('[reset-all-player-progress]', error);
  process.exit(1);
});
