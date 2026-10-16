interface Props {
  code: string;
  applied: boolean;
  bonusPercent: number;
  error: string;
  onCodeChange: (value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export function DepositBonusCodeField({
  code,
  applied,
  bonusPercent,
  error,
  onCodeChange,
  onApply,
  onClear,
}: Props) {
  return (
    <div className="rounded-xl border border-gold/30 bg-gradient-to-r from-gold/15 via-gold/5 to-transparent px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[10px] font-black uppercase tracking-[0.12em] text-gold">
            Bonus code
          </p>
          <p className="mt-0.5 text-[10px] text-white/40">
            Have a promo? Enter it here for extra deposit credit.
          </p>
        </div>
        <input
          type="text"
          value={code}
          disabled={applied}
          autoComplete="off"
          onChange={event => onCodeChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (code.trim()) onApply();
            }
          }}
          placeholder="Enter bonus code"
          className="input-filter min-w-[9rem] flex-1 py-2 text-xs uppercase tracking-wide disabled:opacity-50 sm:max-w-[14rem]"
        />
        {applied ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-lg border border-white/15 px-3 py-2 font-display text-[10px] font-bold uppercase tracking-wide text-white/55 transition hover:border-white/30 hover:text-white"
          >
            Clear
          </button>
        ) : (
          <button
            type="button"
            onClick={onApply}
            disabled={!code.trim()}
            className="shrink-0 rounded-lg border border-gold/50 bg-gradient-to-r from-[#B8732A] via-[#E8A93A] to-[#F0C14D] px-4 py-2 font-display text-[10px] font-black uppercase tracking-wide text-deep shadow-[0_0_16px_rgba(232,169,58,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Apply
          </button>
        )}
      </div>
      {applied && (
        <p className="mt-1.5 text-[11px] font-semibold text-win">
          +{bonusPercent}% deposit bonus applied
        </p>
      )}
      {error && (
        <p className="mt-1.5 text-[11px] text-risk">{error}</p>
      )}
    </div>
  );
}
