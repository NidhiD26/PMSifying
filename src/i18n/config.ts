import { LOCALES, DEFAULT_LOCALE, Locale } from '@/types/i18n';

export const locales = LOCALES;
export const defaultLocale = DEFAULT_LOCALE;

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
