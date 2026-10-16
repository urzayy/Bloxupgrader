import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { completeTutorial } from '../../lib/tutorialApi';
import { useAuth } from '../../context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  /** When true, finishing/skipping marks IP + local as seen. */
  markSeenOnClose?: boolean;
}

interface TutorialStep {
  id: string;
  title: string;
  body: string;
  kind: 'welcome' | 'account' | 'deposit' | 'upgrade' | 'cases';
}

const STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to BloxUpgrader',
    body: 'Stake RAP or your skins to chase bigger drops. Pick a target, set your risk, and upgrade — a one-minute tour.',
    kind: 'welcome',
  },
  {
    id: 'account',
    title: 'Create your account',
    body: 'Tap Login, enter your email and password. New emails create an account automatically after you accept age + terms. Returning players just sign in.',
    kind: 'account',
  },
  {
    id: 'deposit',
    title: 'Add RAP to play',
    body: 'Use Deposit to fund your balance with RAP. That balance is what you stake on upgrades, cases, and battles.',
    kind: 'deposit',
  },
  {
    id: 'upgrade',
    title: 'Upgrade Cave',
    body: 'Select skins from your inventory (or buy in the shop), choose a higher-value target, then roll. Higher multipliers = lower chance, bigger win.',
    kind: 'upgrade',
  },
  {
    id: 'cases',
    title: 'Open cases & explore',
    body: 'Browse Cases for curated loot, join battles, and climb free cases as you play. Provably fair rolls keep every spin verifiable.',
    kind: 'cases',
  },
];

const SHOWCASE = [
  { name: 'AUG | Hot Rod', price: 7, image: '/images/skins/aug-hot-rod.png' },
  { name: 'AK-47 | Sakura', price: 501, image: '/images/skins/ak-47-sakura.png' },
  { name: 'AWP | Tekko', price: 102, image: '/images/skins/awp-tekko.png' },
  { name: 'Karambit | Aurora', price: 229779, image: '/images/skins/karambit-aurora.png' },
];

function StepVisual({ kind }: { kind: TutorialStep['kind'] }) {
  if (kind === 'welcome') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/15 bg-white/5">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 19V5M12 5l-5 5M12 5l5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-display text-2xl font-black tracking-[0.14em] text-white sm:text-3xl">
          BLOX<span className="text-gold">UPGRADER</span>
        </p>
        <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-4">
          {SHOWCASE.map(skin => (
            <div key={skin.name} className="flex w-[4.5rem] flex-col items-center gap-1 sm:w-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-white/10 bg-deep/80 sm:h-[4.5rem] sm:w-[4.5rem]">
                <img src={skin.image} alt="" className="max-h-[85%] max-w-[85%] object-contain" draggable={false} />
              </div>
              <span className="truncate text-center text-[9px] text-white/45">{skin.name.split('|')[1]?.trim()}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const icons: Record<Exclude<TutorialStep['kind'], 'welcome'>, string> = {
    account: '👤',
    deposit: '◆',
    upgrade: '⬆',
    cases: '▣',
  };

  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 font-display text-3xl text-gold shadow-[0_0_40px_rgba(232,169,58,0.2)]">
        {icons[kind]}
      </div>
    </div>
  );
}

export function SiteTutorialModal({ open, onClose, markSeenOnClose = true }: Props) {
  const { openLogin } = useAuth();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const current = STEPS[step];
  const total = STEPS.length;

  useEffect(() => {
    if (!open) {
      setStep(0);
      setPlaying(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !playing) return;
    const id = window.setTimeout(() => {
      if (step >= total - 1) {
        setPlaying(false);
        return;
      }
      setStep(s => Math.min(total - 1, s + 1));
    }, 6500);
    return () => window.clearTimeout(id);
  }, [open, playing, step, total]);

  const finish = async () => {
    if (markSeenOnClose) await completeTutorial();
    onClose();
  };

  const goLogin = async () => {
    if (markSeenOnClose) await completeTutorial();
    onClose();
    openLogin();
  };

  const progress = useMemo(
    () => STEPS.map((_, i) => (i <= step ? 'bg-gold shadow-[0_0_8px_rgba(232,169,58,0.65)]' : 'bg-white/15')),
    [step],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={e => {
            if (e.target === e.currentTarget) void finish();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="How BloxUpgrader works"
            className="flex max-h-[min(92dvh,720px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#12151c] shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-risk shadow-[0_0_8px_rgba(255,51,68,0.7)]" />
                <p className="font-display text-[10px] font-bold uppercase tracking-[0.16em] text-white/85 sm:text-[11px]">
                  How BloxUpgrader works
                </p>
              </div>
              <button
                type="button"
                onClick={() => void finish()}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition hover:border-white/25 hover:text-white"
                aria-label="Close tutorial"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5 px-4 pt-3 sm:grid-cols-5 sm:px-5">
              {progress.map((cls, i) => (
                <div key={STEPS[i].id} className={`h-1.5 rounded-full transition ${cls}`} />
              ))}
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(232,169,58,0.08),transparent_65%)]" />
              <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
                <StepVisual kind={current.kind} />
                <div className="mt-6 w-full max-w-lg text-left sm:mt-8">
                  <h2 className="font-display text-lg font-bold text-white sm:text-xl">{current.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/55 sm:text-[15px]">{current.body}</p>
                  {current.kind === 'account' && (
                    <button
                      type="button"
                      onClick={() => void goLogin()}
                      className="mt-4 rounded-lg border border-gold/40 bg-gold/15 px-4 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-gold transition hover:bg-gold/25"
                    >
                      Open login
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/8 bg-[#0e1117] px-3 py-3 sm:px-5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={step === 0}
                  onClick={() => setStep(s => Math.max(0, s - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                  aria-label="Previous step"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying(p => !p)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold transition ${
                    playing
                      ? 'border-white bg-white text-deep'
                      : 'border-white/10 bg-white/5 text-white/70 hover:border-white/25'
                  }`}
                  aria-label={playing ? 'Pause autoplay' : 'Play autoplay'}
                >
                  {playing ? '❚❚' : '▶'}
                </button>
                <button
                  type="button"
                  disabled={step >= total - 1}
                  onClick={() => setStep(s => Math.min(total - 1, s + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-30"
                  aria-label="Next step"
                >
                  ›
                </button>
                <span className="ml-1 font-display text-[11px] tabular-nums text-white/45">
                  {step + 1} / {total}
                </span>
              </div>

              {step >= total - 1 ? (
                <button
                  type="button"
                  onClick={() => void finish()}
                  className="rounded-lg bg-gradient-to-r from-[#B8732A] via-[#E8A93A] to-[#F0C14D] px-4 py-2 font-display text-[11px] font-black uppercase tracking-wide text-deep"
                >
                  Got it
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void finish()}
                  className="px-2 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-white/70 transition hover:text-white"
                >
                  Skip
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
