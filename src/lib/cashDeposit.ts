/** USD / PayPal / Crypto deposit conversion (site balance). */
/** Reference rate: $3 = 1,000 balance → ~333.33 balance per $1. */
export const USD_DEPOSIT_REF_USD = 3;
export const USD_DEPOSIT_REF_BALANCE = 1_000;

/** Balance credited per $1 (exact: 1000/3). Prefer calcUsdDepositCredit for amounts. */
export const USD_TO_SALDO_RATE = USD_DEPOSIT_REF_BALANCE / USD_DEPOSIT_REF_USD;

export const MIN_USD_DEPOSIT = 1;

export const USD_DEPOSIT_PRESETS = [1, 2, 3] as const;

export function validateUsdDepositAmount(usdAmount: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) {
    return { ok: false, error: 'Enter a valid dollar amount.' };
  }
  if (usdAmount < MIN_USD_DEPOSIT) {
    return {
      ok: false,
      error: `Minimum deposit is $${MIN_USD_DEPOSIT.toLocaleString('en-US')}.`,
    };
  }
  if (usdAmount > 100_000) {
    return { ok: false, error: 'Amount is too large.' };
  }
  return { ok: true };
}

export function calcUsdDepositCredit(usdAmount: number): number {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 0;
  // Keep $3 → exactly 1,000 (avoid float drift from 1000/3).
  return Math.floor((usdAmount * USD_DEPOSIT_REF_BALANCE) / USD_DEPOSIT_REF_USD);
}

export function formatUsdDepositRateLabel(): string {
  return `${USD_DEPOSIT_REF_USD}$ = ${USD_DEPOSIT_REF_BALANCE.toLocaleString('en-US')} balance`;
}
