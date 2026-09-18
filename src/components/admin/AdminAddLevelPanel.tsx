import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createLevelGrant,
  isValidGrantEmail,
  normalizeGrantEmail,
  MAX_LEVEL,
} from '../../lib/levelGrants';

interface Props {
  open: boolean;
  adminEmail: string;
  onClose: () => void;
  onLevelSent?: (targetEmail: string, level: number) => void;
}

export function AdminAddLevelPanel({ open, adminEmail, onClose, onLevelSent }: Props) {
  const [targetEmail, setTargetEmail] = useState('');
  const [level, setLevel] = useState('');
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setTargetEmail('');
      setLevel('');
      setStatus(null);
      setSending(false);
      sendInFlightRef.current = false;
    }
  }, [open]);

  const parsedLevel = Number(level);
  const validLevel = (
    Number.isFinite(parsedLevel)
    && Number.isInteger(parsedLevel)
    && parsedLevel >= 1
    && parsedLevel <= MAX_LEVEL
  );

  const handleSend = async () => {
    if (sending || sendInFlightRef.current) return;

    const email = normalizeGrantEmail(targetEmail);
    if (!isValidGrantEmail(email)) {
      setStatus({ type: 'err', text: 'Enter a valid email address.' });
      return;
    }
    if (!validLevel) {
      setStatus({ type: 'err', text: `Enter a whole level from 1 to ${MAX_LEVEL}.` });
      return;
    }

    sendInFlightRef.current = true;
    setSending(true);
    setStatus(null);
    try {
      await createLevelGrant(email, adminEmail, parsedLevel);
      setStatus({
        type: 'ok',
        text: `Level ${parsedLevel} set for ${email}.`,
      });
      onLevelSent?.(email, parsedLevel);
      setLevel('');
    } catch {
      setStatus({ type: 'err', text: 'Could not set level. Is the server running?' });
    } finally {
      sendInFlightRef.current = false;
      setSending(false);
    }
  };

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
            aria-labelledby="admin-add-level-title"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/25 bg-[#0c0a14] shadow-[0_24px_80px_rgba(0,0,0,0.75),0_0_40px_rgba(176,108,255,0.08)]"
            initial={{ scale: 0.94, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 8, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gold/15 px-4 py-3">
              <div>
                <h2 id="admin-add-level-title" className="font-display text-base font-bold uppercase tracking-wide text-gold">
                  Add Level
                </h2>
                <p className="text-[11px] text-white/45">
                  Set any user&apos;s level by email (1–{MAX_LEVEL})
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/25 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                User email
              </label>
              <input
                type="email"
                value={targetEmail}
                onChange={e => setTargetEmail(e.target.value)}
                placeholder="user@email.com"
                className="input-filter w-full text-sm"
                autoFocus
              />

              <label className="block text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Level
              </label>
              <input
                type="number"
                min={1}
                max={MAX_LEVEL}
                step={1}
                value={level}
                onChange={e => setLevel(e.target.value)}
                placeholder={`e.g. 25 (max ${MAX_LEVEL})`}
                className="input-filter w-full text-sm"
              />

              {status && (
                <p className={`rounded-lg px-3 py-2 text-[11px] ${
                  status.type === 'ok'
                    ? 'border border-win/25 bg-win/10 text-win'
                    : 'border border-risk/25 bg-risk/10 text-risk'
                }`}
                >
                  {status.text}
                </p>
              )}
            </div>

            <div className="flex gap-2 border-t border-white/10 px-4 py-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:border-white/25 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!validLevel || !targetEmail.trim() || sending}
                onClick={() => { void handleSend(); }}
                className="flex-1 rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 font-display text-[11px] font-bold uppercase tracking-wide text-gold transition hover:bg-gold/25 disabled:opacity-35"
              >
                {sending ? 'Sending…' : 'Set Level'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
