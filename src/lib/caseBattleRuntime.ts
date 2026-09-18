import type { Skin } from '../data/skins';
import type { CaseBattle } from './caseBattles';

export function isBattleLobbyFull(battle: CaseBattle): boolean {
  return battle.players.length >= battle.maxPlayers;
}

export function canStartBattle(battle: CaseBattle): boolean {
  return battle.status === 'waiting' && isBattleLobbyFull(battle);
}

export function startBattle(battle: CaseBattle): CaseBattle {
  if (!canStartBattle(battle)) return battle;
  return {
    ...battle,
    status: 'in_progress',
    currentRound: 0,
  };
}

export function isBattleOpeningRound(battle: CaseBattle): boolean {
  return battle.status === 'in_progress' && battle.currentRound < battle.caseSlugs.length;
}

export function isBattleFinished(battle: CaseBattle): boolean {
  return battle.status === 'finished' || battle.currentRound >= battle.caseSlugs.length;
}

export function applyBattleRoundResults(
  battle: CaseBattle,
  dropsByPlayerId: Record<string, Skin>,
): CaseBattle {
  // Idempotent: this round was already applied (stale pendingRound / sync race).
  const alreadyApplied = battle.players.some(
    player => (player.drops?.length ?? 0) > battle.currentRound,
  );
  if (alreadyApplied) {
    const nextRound = Math.max(
      battle.currentRound,
      Math.max(...battle.players.map(player => player.drops?.length ?? 0), 0),
    );
    const finished = nextRound >= battle.caseSlugs.length;
    return {
      ...battle,
      currentRound: Math.min(nextRound, battle.caseSlugs.length),
      status: finished ? 'finished' : battle.status === 'waiting' ? 'waiting' : 'in_progress',
      finishedAt: finished ? (battle.finishedAt ?? Date.now()) : battle.finishedAt,
      pendingRound: undefined,
    };
  }

  const players = battle.players.map(player => {
    const skin = dropsByPlayerId[player.id];
    if (!skin) return player;

    const drops = [...(player.drops ?? []), skin];
    const totalValue = drops.reduce((sum, entry) => sum + entry.price, 0);
    return { ...player, drops, totalValue };
  });

  const nextRound = battle.currentRound + 1;
  const finished = nextRound >= battle.caseSlugs.length;

  return {
    ...battle,
    players,
    currentRound: nextRound,
    status: finished ? 'finished' : 'in_progress',
    finishedAt: finished ? (battle.finishedAt ?? Date.now()) : battle.finishedAt,
    pendingRound: undefined,
  };
}

export function getBattleRoundCaseSlug(battle: CaseBattle): string | null {
  if (!isBattleOpeningRound(battle)) return null;
  return battle.caseSlugs[battle.currentRound] ?? null;
}

export function getBattleRoundJoker(battle: CaseBattle): boolean {
  if (!isBattleOpeningRound(battle)) return false;
  return battle.jokerFlags[battle.currentRound] ?? false;
}
