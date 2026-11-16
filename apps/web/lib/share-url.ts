import { DEFAULT_LOCALE } from '@globetrot/i18n';

/**
 * The public address of a shared trip. Shared in another language than the default, the link names it, so friends
 * open the page in the language the trip was written in (a link that names its language is the clicker's choice,
 * docs/architecture/i18n.md).
 */
export function sharedTripUrl(origin: string, slug: string, locale: string): string {
  const base = `${origin}/t/${slug}`;
  return locale === DEFAULT_LOCALE ? base : `${base}?lang=${encodeURIComponent(locale)}`;
}
