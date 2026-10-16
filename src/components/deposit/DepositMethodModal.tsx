import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DISCORD_INVITE_URL } from '../../lib/discordUrl';
import { DEPOSIT_SKINS_ICON, ROBUX_DEPOSIT_ICON } from '../../lib/devRobuxDeposit';
import { formatUsdDepositRateLabel } from '../../lib/cashDeposit';
import type { AppliedDepositBonus } from '../../lib/depositBonusCode';
import type { WithdrawTicketBundle } from '../../lib/withdrawChat';
import { DepositSkinsPanel, type DepositItem } from './DepositSkinsPanel';

type DepositMethod = 'skins' | 'robux' | 'paypal' | 'crypto';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectRobux: () => void;
  /** Preferred: skins catalog renders inline. */
  onRequestDeposit?: (items: DepositItem[], bonus?: AppliedDepositBonus) => Promise<WithdrawTicketBundle | null>;
  /** Fallback if onRequestDeposit is missing — opens legacy skins modal. */
  onSelectSkins?: () => void;
  /** @deprecated Cash/PayPal/Crypto open Discord from this modal. */
  onSelectCash?: () => void;
}

function DiscordLogo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function MethodTile({
  active,
  label,
  badge,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  badge?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex min-h-[5.75rem] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 transition ${
        active
          ? 'border-win bg-win/10 shadow-[0_0_20px_rgba(0,230,118,0.18)]'
          : 'border-white/10 bg-[#151922] hover:border-white/20 hover:bg-[#1a2030]'
      }`}
    >
      {badge && (
        <span className="absolute right-1.5 top-1.5 rounded bg-win px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-deep">
          {badge}
        </span>
      )}
      <div className="flex h-10 w-full items-center justify-center">{children}</div>
      <span className={`font-display text-[10px] font-bold uppercase tracking-wide ${active ? 'text-win' : 'text-white/55'}`}>
        {label}
      </span>
    </button>
  );
}

function DiscordPanel({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#5865F2]/40 bg-[#5865F2]/15 text-[#7289DA] shadow-[0_0_28px_rgba(88,101,242,0.25)]">
        <DiscordLogo className="h-8 w-8" />
      </div>
      <div className="max-w-lg space-y-2">
        <h3 className="font-display text-xl font-black uppercase tracking-wide text-white">{title}</h3>
        <p className="text-sm leading-relaxed text-white/50">{blurb}</p>
        <p className="text-xs text-white/35">{formatUsdDepositRateLabel()}</p>
      </div>
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/50 bg-gradient-to-r from-[#5865F2] to-[#4752C4] px-6 py-3.5 font-display text-xs font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(88,101,242,0.35)] transition hover:brightness-110"
      >
        <DiscordLogo className="h-4 w-4" />
        Open Discord
      </a>
    </div>
  );
}

export function DepositMethodModal({
  open,
  onClose,
  onSelectRobux,
  onRequestDeposit,
  onSelectSkins,
}: Props) {
  const [method, setMethod] = useState<DepositMethod>('skins');

  useEffect(() => {
    if (open) setMethod('skins');
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[125] flex items-center justify-center p-2 sm:p-4"
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
            aria-labelledby="deposit-method-title"
            className="relative flex h-[min(94dvh,900px)] w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e1218] shadow-[0_28px_90px_rgba(0,0,0,0.8)] sm:flex-row"
            initial={{ scale: 0.96, y: 14, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, y: 8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <aside className="shrink-0 border-b border-white/8 bg-[#0b0e13] p-3 sm:w-[14.5rem] sm:border-b-0 sm:border-r sm:p-4">
              <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
                <h2
                  id="deposit-method-title"
                  className="font-display text-sm font-black uppercase tracking-wide text-white"
                >
                  Deposit
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/50 transition hover:border-white/25 hover:text-white sm:hidden"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
                <MethodTile
                  active={method === 'skins'}
                  label="Pay by skins"
                  badge="Instant"
                  onClick={() => setMethod('skins')}
                >
                  <img src={DEPOSIT_SKINS_ICON} alt="" className="h-9 w-9 object-contain" draggable={false} />
                </MethodTile>

                <MethodTile
                  active={method === 'robux'}
                  label="Robux"
                  onClick={() => setMethod('robux')}
                >
                  <img src={ROBUX_DEPOSIT_ICON} alt="" className="h-9 w-9 object-contain" draggable={false} />
                </MethodTile>

                <MethodTile
                  active={method === 'paypal'}
                  label="PayPal"
                  onClick={() => setMethod('paypal')}
                >
                  <span className="rounded bg-[#003087] px-2 py-1 font-display text-[11px] font-black tracking-wide text-white">
                    PayPal
                  </span>
                </MethodTile>

                <MethodTile
                  active={method === 'crypto'}
                  label="Crypto"
                  onClick={() => setMethod('crypto')}
                >
                  <div className="flex items-center gap-1">
                    {['₿', 'Ξ', 'Ł', 'Ð'].map(sym => (
                      <span
                        key={sym}
                        className="flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] font-bold text-gold"
                      >
                        {sym}
                      </span>
                    ))}
                  </div>
                </MethodTile>
              </div>
            </aside>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="absolute right-3 top-3 z-20 hidden sm:block">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-white/55 transition hover:border-white/25 hover:text-white"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {method === 'skins' && (
                onRequestDeposit ? (
                  <DepositSkinsPanel
                    onRequestDeposit={onRequestDeposit}
                    onSuccess={onClose}
                  />
                ) : (
                  <div className="flex h-full flex-col justify-between gap-6 p-6 sm:p-8">
                    <div className="space-y-4">
                      <p className="font-display text-lg font-black uppercase tracking-wide text-white">
                        Pay by skins
                      </p>
                      <p className="text-sm text-white/50">
                        Open the skins catalog to choose what you want to deposit.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectSkins?.();
                      }}
                      className="w-full rounded-xl bg-gradient-to-r from-[#B8732A] via-[#E8A93A] to-[#F0C14D] py-3.5 font-display text-sm font-black uppercase tracking-wide text-deep"
                    >
                      Select skins
                    </button>
                  </div>
                )
              )}

              {method === 'robux' && (
                <div className="flex h-full flex-col justify-between gap-6 overflow-y-auto p-6 sm:p-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-win/25 bg-black/40 p-3">
                        <img src={ROBUX_DEPOSIT_ICON} alt="" className="h-full w-full object-contain" draggable={false} />
                      </div>
                      <div>
                        <p className="font-display text-lg font-black uppercase tracking-wide text-white">
                          Robux deposit
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/50">
                          Convert Robux into site balance through a live deposit ticket.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-risk/45 bg-risk/15 px-4 py-4">
                      <p className="font-display text-xs font-black uppercase tracking-[0.14em] text-risk">
                        Important — RBLX Plus required
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-white/70">
                        You need <span className="font-semibold text-white">Roblox Premium (RBLX Plus)</span> to complete
                        a Robux deposit. Without Premium, the trade cannot go through and your deposit will be rejected.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectRobux();
                    }}
                    className="w-full rounded-xl border border-win/40 bg-win/15 py-3.5 font-display text-sm font-black uppercase tracking-wide text-win transition hover:bg-win/25"
                  >
                    I have RBLX Plus — continue
                  </button>
                </div>
              )}

              {method === 'paypal' && (
                <DiscordPanel
                  title="PayPal deposit"
                  blurb="PayPal deposits are handled by staff on Discord. Open a deposit ticket, send the amount, and wait for confirmation before closing the chat."
                />
              )}

              {method === 'crypto' && (
                <DiscordPanel
                  title="Crypto deposit"
                  blurb="Crypto deposits (BTC, ETH, LTC, and more) are processed via Discord. Join, open a deposit ticket, and our team will send payment details."
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
