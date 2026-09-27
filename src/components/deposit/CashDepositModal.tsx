import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  calcUsdDepositCredit,
  MIN_USD_DEPOSIT,
  USD_TO_SALDO_RATE,
  validateUsdDepositAmount,
} from '../../lib/cashDeposit';
import { DISCORD_INVITE_URL } from '../../lib/discordUrl';
import { CoinPrice } from '../ui/CoinPrice';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CashDepositModal({ open, onClose }: Props) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const usdAmount = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.round(value * 100) / 100;
  }, [amount]);

  const creditTotal = useMemo(
    () => (usdAmount > 0 ? calcUsdDepositCredit(usdAmount) : 0),
    [usdAmount],
  );

  useEffect(() => {
    if (!open) {
      setAmount('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (usdAmount <= 0) {
      setError('Enter a valid dollar amount.');
      return;
    }
    const validation = validateUsdDepositAmount(usdAmount);
    if (!validation.ok) {
      setError(validation.error ?? 'Invalid deposit amount.');
      return;
    }
    window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[125] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cash-deposit-title"
            className="relative w-full max-w-md rounded-2xl border border-win/25 bg-[#0c0a14] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-win/20 bg-black/30">
              <span className="font-display text-3xl font-black text-win">$</span>
            </div>

            <h2
              id="cash-deposit-title"
              className="mt-4 text-center font-display text-lg font-bold uppercase tracking-wide text-win"
            >
              PayPal / Crypto
            </h2>
            <p className="mt-2 text-center text-sm text-white/55">
              How many dollars do you want to deposit?
            </p>
            <p className="mt-1 text-center text-[11px] font-semibold text-gold">
              1$ = {USD_TO_SALDO_RATE.toLocaleString('en-US')} balance · Minimum ${MIN_USD_DEPOSIT}
            </p>
            <p className="mt-3 rounded-lg border border-win/20 bg-win/5 px-3 py-2 text-center text-[11px] leading-relaxed text-white/70">
              To deposit with PayPal or crypto, go to our Discord and create a ticket.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={MIN_USD_DEPOSIT}
                  step={0.01}
                  inputMode="decimal"
                  value={amount}
                  onChange={e => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  placeholder="$"
                  className="input-filter min-w-0 flex-1 text-center text-base"
                />
                {usdAmount > 0 && (
                  <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/5 px-2.5 py-2">
                    <span className="text-[10px] font-bold uppercase text-white/40">=</span>
                    <CoinPrice
                      value={creditTotal}
                      iconClassName="h-3.5 w-3.5"
                      textClassName="font-display text-sm font-bold text-gold"
                    />
                  </div>
                )}
              </div>

              {error && (
                <p className="rounded-lg border border-risk/25 bg-risk/10 px-3 py-2 text-center text-[11px] text-risk">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-lg border border-win/35 py-2.5 text-xs text-white/80 transition hover:border-win/55 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!amount.trim()}
                  className="flex-1 rounded-lg border border-win/40 bg-win/15 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-win transition hover:bg-win/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Open Discord
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
