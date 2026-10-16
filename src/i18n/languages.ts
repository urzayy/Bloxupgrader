/** Top 10 languages by total speakers (Ethnologue-style ranking). */
export const LOCALE_CODES = [
  'en',
  'zh',
  'hi',
  'es',
  'fr',
  'ar',
  'bn',
  'pt',
  'ru',
  'ur',
] as const;

export type LocaleCode = (typeof LOCALE_CODES)[number];

export interface LocaleOption {
  code: LocaleCode;
  /** English name for accessibility / fallback. */
  nameEn: string;
  /** Native endonym shown in the picker. */
  nativeName: string;
  /** BCP 47 tag for Intl / document.lang. */
  bcp47: string;
  dir: 'ltr' | 'rtl';
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', nameEn: 'English', nativeName: 'English', bcp47: 'en', dir: 'ltr' },
  { code: 'zh', nameEn: 'Mandarin Chinese', nativeName: '中文', bcp47: 'zh-CN', dir: 'ltr' },
  { code: 'hi', nameEn: 'Hindi', nativeName: 'हिन्दी', bcp47: 'hi', dir: 'ltr' },
  { code: 'es', nameEn: 'Spanish', nativeName: 'Español', bcp47: 'es', dir: 'ltr' },
  { code: 'fr', nameEn: 'French', nativeName: 'Français', bcp47: 'fr', dir: 'ltr' },
  { code: 'ar', nameEn: 'Arabic', nativeName: 'العربية', bcp47: 'ar', dir: 'rtl' },
  { code: 'bn', nameEn: 'Bengali', nativeName: 'বাংলা', bcp47: 'bn', dir: 'ltr' },
  { code: 'pt', nameEn: 'Portuguese', nativeName: 'Português', bcp47: 'pt', dir: 'ltr' },
  { code: 'ru', nameEn: 'Russian', nativeName: 'Русский', bcp47: 'ru', dir: 'ltr' },
  { code: 'ur', nameEn: 'Urdu', nativeName: 'اردو', bcp47: 'ur', dir: 'rtl' },
];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALE_STORAGE_KEY = 'blox-upgrader/locale';

export function isLocaleCode(value: unknown): value is LocaleCode {
  return typeof value === 'string' && (LOCALE_CODES as readonly string[]).includes(value);
}

export function getLocaleOption(code: LocaleCode): LocaleOption {
  return LOCALE_OPTIONS.find(o => o.code === code) ?? LOCALE_OPTIONS[0];
}
