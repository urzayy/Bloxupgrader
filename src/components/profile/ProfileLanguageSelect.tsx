import { useLocale } from '../../i18n/LocaleContext';
import { LOCALE_OPTIONS, type LocaleCode } from '../../i18n/languages';

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-[#C084FC]" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.2 3.8 8.5S14.5 18.1 12 20.5C9.5 18.1 8.2 15.3 8.2 12S9.5 5.9 12 3.5Z" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ProfileLanguageSelect() {
  const { locale, setLocale, t } = useLocale();

  return (
    <label className="mt-3 flex w-full items-center gap-3 rounded-lg border border-white/10 bg-[#1a1530] px-4 py-3 transition hover:border-white/20">
      <GlobeIcon />
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-white/65 lg:text-xs">
        {t('profile.language')}
      </span>
      <select
        value={locale}
        onChange={e => setLocale(e.target.value as LocaleCode)}
        aria-label={t('profile.language')}
        className="min-w-0 flex-1 cursor-pointer appearance-none rounded-md border border-white/10 bg-[#100d1a] px-3 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#A855F7]/60"
      >
        {LOCALE_OPTIONS.map(option => (
          <option key={option.code} value={option.code}>
            {option.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
