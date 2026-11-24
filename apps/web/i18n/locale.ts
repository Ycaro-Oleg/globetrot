import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  parseAcceptLanguage,
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

/** How the language cookie is stored, wherever it is set: a year, this site only, never readable by scripts. */
export function localeCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  } as const;
}

/**
 * The language to offer a visitor who has not chosen one, from the browser's `Accept-Language`, or null when it
 * is the language already shown. It is only an offer: nothing changes until the visitor picks it.
 */
export function suggestedLocale(
  acceptLanguage: string | null,
  current: SupportedLocale,
): SupportedLocale | null {
  const tags = parseAcceptLanguage(acceptLanguage);
  if (tags.length === 0) return null;
  const best = negotiateLocale(tags);
  return best === current ? null : best;
}
