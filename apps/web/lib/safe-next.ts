/** Where a person goes after logging in when `next` is missing or not acceptable. */
export const DEFAULT_AFTER_LOGIN = '/app';

/** An auth page link that keeps where the person was headed (`next` must already be safe). */
export function withNext(path: string, next: string): string {
  return next === DEFAULT_AFTER_LOGIN ? path : `${path}?next=${encodeURIComponent(next)}`;
}

/**
 * Anything that a URL parser treats specially: C0 controls and DEL (a tab or newline inside "//" is dropped by
 * browsers, turning "/\t/evil.example" into "//evil.example"), and backslashes (read as "/").
 */
export function hasForbiddenCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/**
 * The `next` parameter of the log-in page, reduced to a path on **this** site, or `fallback`. Only a value that
 * starts with exactly one `/` is accepted, so absolute URLs (`https://evil.example`, `javascript:…`),
 * protocol-relative ones (`//evil.example`) and the backslash and control-character tricks all fall back.
 * Without this, a log-in link could send a freshly signed-in person to a look-alike site.
 */
export function safeNext(
  value: string | readonly string[] | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (typeof value !== 'string') return fallback;
  if (value.length === 0 || value.length > 2048) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (hasForbiddenCharacter(value)) return fallback;

  // Belt and braces: resolve it the way a browser would and insist it stays on the same origin.
  try {
    const probe = new URL(value, 'https://globetrot.invalid');
    if (probe.origin !== 'https://globetrot.invalid') return fallback;
    return `${probe.pathname}${probe.search}${probe.hash}`;
  } catch {
    return fallback;
  }
}
