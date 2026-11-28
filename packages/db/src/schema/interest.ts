// The interest list (ADR-0037, docs/product/business-rules.md#interest-list): addresses of visitors without an
// account, with double opt-in. No IP address is stored, and nothing here references `user`: an entry is matched
// to an account by its verified email only when the account is exported or deleted.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const interestListEntry = pgTable(
  'interest_list_entry',
  {
    id: uuid('id').primaryKey(),
    /** Trimmed and lower case, nothing else changed. */
    email: text('email').notNull().unique(),
    locale: text('locale').notNull(),
    /** Which form it came from: `landing` or `itinerary`. */
    source: text('source').notNull(),
    /** The first visit's origin: campaign tags, the referring host name, the first page's path (no query). */
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    referrerDomain: text('referrer_domain'),
    landingPath: text('landing_path'),
    /** A team or test entry: goes through the whole flow, never counts. */
    internal: boolean('internal').notNull().default(false),
    consentAt: instant('consent_at').notNull(),
    /** The consent wording agreed to (`INTEREST_LIST.consentVersion`). */
    consentVersion: text('consent_version').notNull(),
    /** Null until the link in the confirmation email is used: only confirmed entries are on the list. */
    confirmedAt: instant('confirmed_at'),
    /** SHA-256 (hex) of the latest confirmation link's secret; the secret itself is never stored. */
    confirmHash: text('confirm_hash'),
    confirmExpiresAt: instant('confirm_expires_at'),
    /** Anti-flooding: confirmation emails sent since the start of the current 24 hours. */
    sendsWindowStart: instant('sends_window_start'),
    sendsInWindow: integer('sends_in_window').notNull().default(0),
    createdAt: instant('created_at').notNull().defaultNow(),
  },
  (table) => [
    check('interest_list_entry_locale_valid', sql`${table.locale} in ('en', 'pt-BR')`),
    check('interest_list_entry_source_valid', sql`${table.source} in ('landing', 'itinerary')`),
    check('interest_list_entry_email_normal', sql`${table.email} = lower(btrim(${table.email}))`),
    check('interest_list_entry_sends_valid', sql`${table.sendsInWindow} >= 0`),
    // The 7-day sweep of unconfirmed entries.
    index('interest_list_entry_pending_idx')
      .on(table.createdAt)
      .where(sql`${table.confirmedAt} is null`),
  ],
);

/**
 * Addresses that unsubscribed, kept only as an HMAC-SHA256 (key derived from the auth secret), so the list never
 * emails them again. Not reversible; rotating the auth secret empties it in effect.
 */
export const interestListSuppression = pgTable('interest_list_suppression', {
  emailHash: text('email_hash').primaryKey(),
  unsubscribedAt: instant('unsubscribed_at').notNull().defaultNow(),
});

/** Confirmation emails sent per UTC day, for the list's daily ceiling. */
export const interestEmailDay = pgTable('interest_email_day', {
  day: date('day').primaryKey(),
  sent: integer('sent').notNull().default(0),
});
