import fs from 'node:fs';
import path from 'node:path';

const BATTLE_FINISH_GRACE_MS = 5000;

function battleCreatedAt(id) {
  const match = String(id).match(/^battle-(\d+)-/);
  if (!match) return null;
  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isBattleFinished(battle) {
  return (
    battle?.status === 'finished'
    || (typeof battle?.currentRound === 'number'
      && Array.isArray(battle?.caseSlugs)
      && battle.currentRound >= battle.caseSlugs.length)
  );
}

function dropCount(battle) {
  return (battle.players ?? []).reduce((sum, player) => sum + (player.drops?.length ?? 0), 0);
}

function settledCount(battle) {
  return battle.settledUserIds?.length ?? 0;
}

function battleProgressScore(battle) {
  const statusScore =
    battle.status === 'finished' ? 4
      : battle.status === 'in_progress' ? 2
        : 1;
  return (
    statusScore * 1_000_000_000
    + Math.max(0, Number(battle.currentRound) || 0) * 1_000_000
    + dropCount(battle) * 1_000
    + settledCount(battle) * 10
    + Math.floor((Number(battle.finishedAt) || 0) / 1000)
  );
}

function mergeSettledUserIds(left, right) {
  if (!left?.length && !right?.length) return left ?? right;
  return [...new Set([...(left ?? []), ...(right ?? [])])];
}

function preferAdvancedBattle(local, incoming) {
  const localScore = battleProgressScore(local);
  const incomingScore = battleProgressScore(incoming);
  const primary = incomingScore > localScore ? incoming : local;
  const secondary = incomingScore > localScore ? local : incoming;
  const settledUserIds = mergeSettledUserIds(primary.settledUserIds, secondary.settledUserIds);
  const economySettled = Boolean(primary.economySettled || secondary.economySettled);
  let pendingRound = primary.pendingRound;
  if (primary.status === 'finished') {
    pendingRound = undefined;
  } else if (
    pendingRound
    && typeof pendingRound.roundIndex === 'number'
    && pendingRound.roundIndex < primary.currentRound
  ) {
    pendingRound = undefined;
  }
  return {
    ...primary,
    settledUserIds,
    economySettled,
    pendingRound,
    finishedAt: primary.finishedAt ?? secondary.finishedAt,
  };
}

function areAllHumansSettled(battle) {
  const humans = (battle.players ?? []).filter(player => !player.isBot).map(player => player.id);
  if (humans.length === 0) return true;
  const settled = new Set(battle.settledUserIds ?? []);
  return humans.every(id => settled.has(id));
}

function shouldPersistBattle(battle) {
  if (!battle?.id || !battle.createdByUserId) return false;
  if (!Array.isArray(battle.players) || battle.players.length === 0) return false;
  if (!Array.isArray(battle.caseSlugs) || battle.caseSlugs.length === 0) return false;

  if (battle.status === 'finished' || isBattleFinished(battle)) {
    const finishedAt = battle.finishedAt ?? battleCreatedAt(battle.id);
    if (finishedAt && Date.now() - finishedAt < BATTLE_FINISH_GRACE_MS) {
      return true;
    }
    return !areAllHumansSettled(battle);
  }

  const createdAt = battleCreatedAt(battle.id);
  if (
    createdAt
    && battle.status === 'waiting'
    && battle.players.length < battle.maxPlayers
    && Date.now() - createdAt > 2 * 60 * 60 * 1000
  ) {
    return false;
  }

  return battle.status === 'waiting' || battle.status === 'in_progress';
}

function isLiveCaseBattle(battle) {
  return (
    Boolean(battle?.createdByUserId)
    && Array.isArray(battle.players)
    && battle.players.length > 0
    && battle.players.every(player => Boolean(player?.id))
    && battle.status !== 'finished'
    && battle.currentRound < battle.caseSlugs.length
    && (battle.status === 'waiting' || battle.status === 'in_progress')
  );
}

export function createCaseBattleStore(rootDir) {
  const filePath = path.join(rootDir, 'live.json');

  function ensureDir() {
    if (!fs.existsSync(rootDir)) fs.mkdirSync(rootDir, { recursive: true });
  }

  function loadAll() {
    ensureDir();
    if (!fs.existsSync(filePath)) {
      const initial = { version: 1, battles: [] };
      fs.writeFileSync(filePath, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!parsed || typeof parsed !== 'object') return { version: 1, battles: [] };
      const battles = Array.isArray(parsed.battles) ? parsed.battles : [];
      return { version: 1, battles };
    } catch {
      return { version: 1, battles: [] };
    }
  }

  function saveBattles(battles) {
    ensureDir();
    const pruned = battles.filter(shouldPersistBattle);
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, battles: pruned }, null, 2), 'utf8');
    return pruned;
  }

  function listLive() {
    const { battles } = loadAll();
    const pruned = battles.filter(shouldPersistBattle);
    if (pruned.length !== battles.length) saveBattles(pruned);
    return pruned.filter(isLiveCaseBattle);
  }

  function getById(battleId) {
    const normalized = String(battleId ?? '').trim().toLowerCase();
    if (!normalized) return null;
    const { battles } = loadAll();
    const battle = battles.find(entry => String(entry.id).toLowerCase() === normalized);
    if (!battle || !shouldPersistBattle(battle)) return null;
    return battle;
  }

  function upsert(battle) {
    if (!battle?.id) return { error: 'invalid_battle' };
    const { battles } = loadAll();
    const normalized = String(battle.id).toLowerCase();
    const index = battles.findIndex(entry => String(entry.id).toLowerCase() === normalized);
    let nextBattle = battle;
    if (index !== -1) {
      nextBattle = preferAdvancedBattle(battles[index], battle);
    }
    const next = index === -1
      ? [nextBattle, ...battles]
      : battles.map((entry, i) => (i === index ? nextBattle : entry));
    const saved = saveBattles(next);
    const stored = saved.find(entry => String(entry.id).toLowerCase() === normalized) ?? nextBattle;
    return { ok: true, battle: stored };
  }

  function remove(battleId) {
    const normalized = String(battleId ?? '').trim().toLowerCase();
    if (!normalized) return { error: 'invalid_id' };
    const { battles } = loadAll();
    const next = battles.filter(entry => String(entry.id).toLowerCase() !== normalized);
    if (next.length === battles.length) return { error: 'not_found' };
    saveBattles(next);
    return { ok: true };
  }

  return {
    listLive,
    getById,
    upsert,
    remove,
  };
}
