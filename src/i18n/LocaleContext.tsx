import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleOption,
  isLocaleCode,
  type LocaleCode,
  type LocaleOption,
} from './languages';
import { translate, type MessageKey } from './messages';

interface LocaleContextValue {
  locale: LocaleCode;
  option: LocaleOption;
  setLocale: (code: LocaleCode) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): LocaleCode {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocaleCode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function applyDocumentLocale(code: LocaleCode): void {
  if (typeof document === 'undefined') return;
  const option = getLocaleOption(code);
  document.documentElement.lang = option.bcp47;
  document.documentElement.dir = option.dir;
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(() => {
    const initial = readStoredLocale();
    applyDocumentLocale(initial);
    return initial;
  });

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    applyDocumentLocale(code);
  }, []);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  const t = useCallback((key: MessageKey) => translate(locale, key), [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    option: getLocaleOption(locale),
    setLocale,
    t,
  }), [locale, setLocale, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useT(): (key: MessageKey) => string {
  return useLocale().t;
}
