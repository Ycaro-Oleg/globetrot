/**
 * The interest list (ADR-0037, docs/product/business-rules.md#interest-list): visitors without an account who
 * asked to hear from Globetrot, with double opt-in. Pure rules only; storage and email live elsewhere.
 */

/** Where the form was. */
export const INTEREST_SOURCES = ['landing', 'itinerary'] as const;
export type InterestSource = (typeof INTEREST_SOURCES)[number];

export const INTEREST_LIST = {
  /** How long a confirmation link works. */
  confirmHours: 48,
  /** Unconfirmed entries are deleted this long after they were made. */
  pendingDays: 7,
  /** Confirmation emails one address may receive in 24 hours. */
  confirmEmailsPerDay: 3,
  /**
   * The consent text the person agreed to: `2026-11-27` is the wording the owner approved that day ("news about
   * Globetrot and trip-planning tips, at most 2 emails a month, unsubscribe in one click"). Bump it in the same
   * change as any new consent copy, so every entry says which wording it accepted.
   */
  consentVersion: '2026-11-27',
} as const;

/** The form of an address that is stored and compared: trimmed and in lower case, nothing else changed. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Domains reserved for documentation and tests (RFC 2606, RFC 6761): never a real person. */
const RESERVED_DOMAINS = new Set(['example.com', 'example.org', 'example.net']);
const RESERVED_TOP_LEVEL = new Set(['test', 'example', 'invalid']);

/** True for an address on a reserved test domain (`example.com`, `*.test`, …). */
export function isReservedTestAddress(email: string): boolean {
  const domain = normalizeEmail(email).split('@').pop() ?? '';
  if (RESERVED_DOMAINS.has(domain)) return true;
  const top = domain.split('.').pop() ?? '';
  return RESERVED_TOP_LEVEL.has(top);
}

/**
 * An internal address never counts in the numbers: one of the team's (`ADMIN_EMAILS`, already lower case) or a
 * reserved test domain. Entries sent with `internal: true` are internal too; that is the caller's to add.
 */
export function isInternalAddress(email: string, adminEmails: readonly string[]): boolean {
  const normal = normalizeEmail(email);
  return adminEmails.includes(normal) || isReservedTestAddress(normal);
}
