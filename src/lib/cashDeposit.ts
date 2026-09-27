/** USD / PayPal / Crypto deposit conversion (site balance). */
export const USD_TO_SALDO_RATE = 3_000;

export const MIN_USD_DEPOSIT = 1;

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
  return Math.floor(usdAmount * USD_TO_SALDO_RATE);
}
