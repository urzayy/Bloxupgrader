import type { CaseBattle } from './caseBattles';

function dropCount(battle: CaseBattle): number {
  return (battle.players ?? []).reduce((sum, player) => sum + (player.drops?.length ?? 0), 0);
}

function settledCount(battle: CaseBattle): number {
  return battle.settledUserIds?.length ?? 0;
}

/** Higher = more progressed battle. Used to ignore stale sync overwrites. */
export function battleProgressScore(battle: CaseBattle): number {
  const statusScore =
    battle.status === 'finished' ? 4
      : battle.status === 'in_progress' ? 2
        : 1;
  return (
    statusScore * 1_000_000_000
    + Math.max(0, battle.currentRound) * 1_000_000
    + dropCount(battle) * 1_000
    + settledCount(battle) * 10
    + Math.floor((battle.finishedAt ?? 0) / 1000)
  );
}

export function mergeSettledUserIds(left?: string[], right?: string[]): string[] | undefined {
  if (!left?.length && !right?.length) return left ?? right;
  return [...new Set([...(left ?? []), ...(right ?? [])])];
}

/** Keep the more advanced snapshot; always union settlement markers. */
export function preferAdvancedBattle(local: CaseBattle, incoming: CaseBattle): CaseBattle {
  const localScore = battleProgressScore(local);
  const incomingScore = battleProgressScore(incoming);

  let primary: CaseBattle;
  let secondary: CaseBattle;

  if (incomingScore > localScore) {
    primary = incoming;
    secondary = local;
  } else if (localScore > incomingScore) {
    primary = local;
    secondary = incoming;
  } else {
    // Same progress: prefer more players (bot/join), else the incoming write.
    const localPlayers = local.players?.length ?? 0;
    const incomingPlayers = incoming.players?.length ?? 0;
    if (incomingPlayers !== localPlayers) {
      primary = incomingPlayers > localPlayers ? incoming : local;
      secondary = incomingPlayers > localPlayers ? local : incoming;
    } else {
      primary = incoming;
      secondary = local;
    }
  }

  const settledUserIds = mergeSettledUserIds(primary.settledUserIds, secondary.settledUserIds);
  const economySettled = Boolean(primary.economySettled || secondary.economySettled);

  // Never resurrect a cleared pending round onto a finished / further-advanced battle.
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

export function mergeBattleLists(local: CaseBattle[], remote: CaseBattle[]): CaseBattle[] {
  const map = new Map<string, CaseBattle>();

  for (const battle of local) {
    if (!battle?.id) continue;
    map.set(battle.id.toLowerCase(), battle);
  }

  for (const battle of remote) {
    if (!battle?.id) continue;
    const key = battle.id.toLowerCase();
    const existing = map.get(key);
    map.set(key, existing ? preferAdvancedBattle(existing, battle) : battle);
  }

  return [...map.values()];
}
