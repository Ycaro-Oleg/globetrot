import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  type SupportedLocale,
} from '@globetrot/i18n';

export { LOCALE_COOKIE };

/** Resolve a stored choice; unsupported or absent values fall back to the product default. */
export function resolveWebLocale(value: string | undefined): SupportedLocale {
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The language of a request. A signed-in user's stored language wins; the cookie is what an anonymous visitor
 * (or a signed-in one whose settings cannot be read) has. `Accept-Language` is never consulted: a detected
 * language is only a suggestion the user confirms.
 */
export function chooseLocale(
  cookieValue: string | undefined,
  stored: { readonly locale: string } | null,
): SupportedLocale {
  if (stored && isSupportedLocale(stored.locale)) return stored.locale;
  return resolveWebLocale(cookieValue);
}
