interface Props {
  active: boolean;
  onClick: () => void;
  className?: string;
}

export function TurboToggleButton({ active, onClick, className = '' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? 'Turbo enabled' : 'Turbo disabled'}
      aria-pressed={active}
      aria-label={active ? 'Disable turbo' : 'Enable turbo'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
        active
          ? 'border-gold bg-gold/15 shadow-[0_0_18px_rgba(232,169,58,0.4)]'
          : 'border-white/10 bg-elevated/90 hover:border-gold/35'
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 transition ${active ? 'drop-shadow-[0_0_6px_rgba(232,169,58,0.8)]' : 'opacity-50'}`}
        aria-hidden="true"
      >
        <path
          d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"
          fill={active ? '#E8A93A' : '#8A7350'}
          stroke="#0a0a0a"
          strokeWidth="1.25"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
