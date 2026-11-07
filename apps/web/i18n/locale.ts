import { DEFAULT_LOCALE, isSupportedLocale, type SupportedLocale } from '@globetrot/i18n';

export const LOCALE_COOKIE = 'globetrot_locale';

/** Resolve a stored choice; unsupported or absent values fall back to the product default. */
export function resolveWebLocale(value: string | undefined): SupportedLocale {
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
