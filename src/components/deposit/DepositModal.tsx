import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppliedDepositBonus } from '../../lib/depositBonusCode';
import type { WithdrawTicketBundle } from '../../lib/withdrawChat';
import { DepositSkinsPanel, type DepositItem } from './DepositSkinsPanel';

export type { DepositItem };

interface Props {
  open: boolean;
  onClose: () => void;
  onRequestDeposit: (items: DepositItem[], bonus?: AppliedDepositBonus) => Promise<WithdrawTicketBundle | null>;
}

export function DepositModal({ open, onClose, onRequestDeposit }: Props) {
  useEffect(() => {
    /* keep modal remount clean when toggled via open */
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-modal-title"
            className="relative flex h-[min(90vh,820px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gold/25 bg-[#0c0a14] shadow-[0_24px_80px_rgba(0,0,0,0.75)]"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gold/15 px-4 py-3">
              <h2 id="deposit-modal-title" className="font-display text-base font-bold uppercase tracking-wide text-gold">
                Deposit
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white"
              >
                Close
              </button>
            </div>

            <DepositSkinsPanel
              onRequestDeposit={onRequestDeposit}
              onSuccess={onClose}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
