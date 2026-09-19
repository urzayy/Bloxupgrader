export function normalizeBalance(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function isSkin(value) {
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

export function normalizeInventory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isSkin).slice(0, 500);
}

export function shouldSkipEmptyPlayerStateOverwrite(existing, balance, inventory) {
  if (!existing) return false;
  const nextBalance = normalizeBalance(balance);
  const nextInventory = normalizeInventory(inventory);
  const incomingEmpty = nextBalance === 0 && nextInventory.length === 0;
  const existingHasData = existing.balance > 0 || (existing.inventory?.length ?? 0) > 0;
  return incomingEmpty && existingHasData;
}

/** Hard caps so DevTools / forged sync cannot invent coins. */
export const MAX_BALANCE_HARD_CAP = 2_000_000;
export const MAX_BALANCE_SYNC_INCREASE = 250_000;

/**
 * Clamp a client-reported balance so it cannot jump far above the last
 * server value (plus any pending admin grants).
 */
export function clampSyncedBalance(existingBalance, requestedBalance, pendingGrantTotal = 0) {
  let nextBalance = normalizeBalance(requestedBalance);
  const existing = normalizeBalance(existingBalance);
  const grants = Math.max(0, Math.floor(Number(pendingGrantTotal) || 0));
  const maxAllowed = Math.min(
    MAX_BALANCE_HARD_CAP,
    existing + grants + MAX_BALANCE_SYNC_INCREASE,
  );
  if (nextBalance > maxAllowed) {
    nextBalance = Math.min(existing, maxAllowed);
  }
  if (nextBalance > MAX_BALANCE_HARD_CAP) nextBalance = MAX_BALANCE_HARD_CAP;
  return { nextBalance, maxAllowed, blocked: normalizeBalance(requestedBalance) > maxAllowed };
}
