/** Officially supported interface languages (ADR-0008). Add a locale here and a catalog in `messages/`. */
export const SUPPORTED_LOCALES = ['en', 'pt-BR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Source language and final fallback. */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function canonical(tag: string): Intl.Locale | null {
  try {
    return new Intl.Locale(tag);
  } catch {
    return null;
  }
}

/**
 * Picks the best supported interface language for the user's preferences, in priority order
 * (e.g. from `Accept-Language` or `navigator.languages`). An exact match wins; otherwise the
 * language alone is matched (`pt-PT` → `pt-BR`, `en-GB` → `en`). Falls back to `DEFAULT_LOCALE`.
 *
 * This only chooses the UI language. It never implies a currency or a country (business rules: Locale and currency).
 */
export function negotiateLocale(preferred: readonly string[]): SupportedLocale {
  const supported = SUPPORTED_LOCALES.map((tag) => ({ tag, locale: new Intl.Locale(tag) }));
  for (const tag of preferred) {
    const wanted = canonical(tag);
    if (!wanted) continue;
    const exact = supported.find((s) => s.locale.baseName === wanted.baseName);
    if (exact) return exact.tag;
    const sameLanguage = supported.find((s) => s.locale.language === wanted.language);
    if (sameLanguage) return sameLanguage.tag;
  }
  return DEFAULT_LOCALE;
}

/** Parses an HTTP `Accept-Language` header into tags ordered by quality. */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag !== '' && entry.tag !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag);
}

/**
 * The cookie in which the web app remembers a visitor's explicit language choice. The API reads it once, at
 * sign-up, to record the language the person was using (the "sign-up locale").
 */
export const LOCALE_COOKIE = 'globetrot_locale';

/** The supported locale named by `LOCALE_COOKIE` in a `Cookie` header, or `null`. Unknown values are ignored. */
export function localeFromCookieHeader(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1 || part.slice(0, separator).trim() !== LOCALE_COOKIE) continue;
    const value = part.slice(separator + 1).trim();
    return isSupportedLocale(value) ? value : null;
  }
  return null;
}
