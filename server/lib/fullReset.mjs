import fs from 'node:fs';
import path from 'node:path';

function clearJsonDir(dir) {
  if (!dir || !fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.json') && !name.endsWith('.txt') && !name.endsWith('.ack.json')) continue;
    try {
      fs.unlinkSync(path.join(dir, name));
      removed += 1;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function writeEmptyBattles(caseBattlesDir) {
  if (!caseBattlesDir) return 0;
  fs.mkdirSync(caseBattlesDir, { recursive: true });
  const file = path.join(caseBattlesDir, 'live.json');
  fs.writeFileSync(file, JSON.stringify({ version: 1, battles: [] }, null, 2), 'utf8');
  return 1;
}

/**
 * Full progress wipe: balances, inventories, grants, chats, battles, announcements,
 * and a global client reset marker so every browser drops stale local state.
 */
export async function runFullProgressReset({
  playerStateStore,
  resetMarkerStore,
  announcementStore,
  grantsDir,
  balanceGrantsDir,
  levelGrantsDir,
  chatsDir,
  caseBattlesDir,
  announcementsDir,
  giveawaysDir,
  logsDir,
  accountResetsDir,
}) {
  const summary = {
    at: Date.now(),
    balances: null,
    globalResetAt: null,
    removed: {},
  };

  if (playerStateStore?.clearAllBalances) {
    summary.balances = await playerStateStore.clearAllBalances();
  }

  if (resetMarkerStore?.markGlobalReset) {
    summary.globalResetAt = resetMarkerStore.markGlobalReset();
  }

  summary.removed.inventoryGrants = clearJsonDir(grantsDir);
  summary.removed.balanceGrants = clearJsonDir(balanceGrantsDir);
  summary.removed.levelGrants = clearJsonDir(levelGrantsDir);
  summary.removed.withdrawChats = clearJsonDir(chatsDir);
  summary.removed.logs = clearJsonDir(logsDir);
  summary.removed.accountResets = clearJsonDir(accountResetsDir);
  // Keep global marker we just wrote — re-apply after clearing resets dir.
  if (resetMarkerStore?.markGlobalReset) {
    summary.globalResetAt = resetMarkerStore.markGlobalReset();
  }

  summary.removed.caseBattles = writeEmptyBattles(caseBattlesDir);

  if (announcementStore?.clear) {
    announcementStore.clear();
    summary.removed.announcements = 1;
  } else {
    summary.removed.announcements = clearJsonDir(announcementsDir);
  }

  // Wipe giveaway runtime state (participants / open slots), keep dir.
  summary.removed.giveaways = clearJsonDir(giveawaysDir);

  return summary;
}

/**
 * Run at most once per token on a given DATA_DIR (survives restarts).
 */
export async function maybeRunBootFullReset(token, dataDir, deps) {
  const normalized = String(token || '').trim();
  if (!normalized || normalized === '0' || normalized.toLowerCase() === 'false') {
    return null;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const marker = path.join(dataDir, `full-reset-done-${normalized.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
  if (fs.existsSync(marker)) {
    console.log(`[reset] boot wipe already applied for token=${normalized}`);
    return null;
  }
  console.warn(`[reset] FORCE_FULL_RESET_ONCE=${normalized} — wiping all progress now`);
  const summary = await runFullProgressReset(deps);
  fs.writeFileSync(marker, JSON.stringify(summary, null, 2), 'utf8');
  console.warn('[reset] wipe complete', summary);
  return summary;
}
