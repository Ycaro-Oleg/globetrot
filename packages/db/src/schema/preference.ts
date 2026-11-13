// One row of settings per user. Language, currency, country, nationality, time zone and units are
// independent columns: nothing derives one from another (business rules, "Locale and currency").
import {
  DEFAULT_CURRENCY,
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  DEFAULT_UNIT_SYSTEM,
  MOTION_CHOICES,
  THEME_CHOICES,
  UNIT_SYSTEMS,
} from '@globetrot/domain';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { boolean, char, check, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

const instant = (name: string) => timestamp(name, { withTimezone: true });

const oneOf = (column: AnyColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '))})`;

export const userPreference = pgTable(
  'user_preference',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Interface language. A new locale means widening `user_preference_locale_valid` in a migration. */
    locale: text('locale').notNull().default(DEFAULT_LOCALE),
    /** Preferred (default) budgeting currency, ISO 4217. Trips keep their own currency. */
    currency: char('currency', { length: 3 }).notNull().default(DEFAULT_CURRENCY),
    /** ISO 3166-1 alpha-2. Optional: nothing requires it. */
    homeCountry: char('home_country', { length: 2 }),
    nationality: char('nationality', { length: 2 }),
    /** IANA name (`America/Sao_Paulo`), canonical spelling. Optional. */
    timeZone: text('time_zone'),
    units: text('units').notNull().default(DEFAULT_UNIT_SYSTEM),
    /** `day`, `red-eye` or `system` (follow the OS). */
    theme: text('theme').notNull().default(DEFAULT_THEME_CHOICE),
    /** `full` or `reduced`; the OS's reduced-motion setting wins over `full` at display time. */
    motion: text('motion').notNull().default(DEFAULT_MOTION_CHOICE),
    /** The city the person usually leaves from, as they wrote it. Optional; personal, never in logs or audit. */
    homeCity: text('home_city'),
    /** Whether the person asked for Pip's suggestions (onboarding). Pip itself stays behind its feature flag. */
    pipOptIn: boolean('pip_opt_in')
      .notNull()
      .default(sql`false`),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    check('user_preference_locale_valid', oneOf(table.locale, SUPPORTED_LOCALES)),
    check('user_preference_currency_format', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check('user_preference_home_country_format', sql`${table.homeCountry} ~ '^[A-Z]{2}$'`),
    check('user_preference_nationality_format', sql`${table.nationality} ~ '^[A-Z]{2}$'`),
    check('user_preference_units_valid', oneOf(table.units, UNIT_SYSTEMS)),
    check('user_preference_theme_valid', oneOf(table.theme, THEME_CHOICES)),
    check('user_preference_motion_valid', oneOf(table.motion, MOTION_CHOICES)),
    check(
      'user_preference_home_city_length',
      sql`${table.homeCity} is null or (${table.homeCity} = btrim(${table.homeCity}) and char_length(${table.homeCity}) between 1 and 120)`,
    ),
  ],
);
