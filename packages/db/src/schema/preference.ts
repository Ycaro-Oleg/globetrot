// One row of settings per user. Language, currency, country, nationality, time zone and units are
// independent columns: nothing derives one from another (business rules, "Locale and currency").
import {
  DEFAULT_CURRENCY,
  DEFAULT_PIP_LOOK,
  PIP_BAG_COLORS,
  PIP_BAGS,
  PIP_HATS,
  PIP_OUTFITS,
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  DEFAULT_UNIT_SYSTEM,
  MOTION_CHOICES,
  THEME_CHOICES,
  UNIT_SYSTEMS,
} from '@globetrot/domain';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  doublePrecision,
  boolean,
  char,
  check,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
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
    /** Where the home city is (picked from the city list), so the map can show where the trip starts. */
    homeLatitude: doublePrecision('home_latitude'),
    homeLongitude: doublePrecision('home_longitude'),
    /** Whether the person asked for Pip's suggestions (onboarding). Pip itself stays behind its feature flag. */
    pipOptIn: boolean('pip_opt_in')
      .notNull()
      .default(sql`false`),
    /** The weekly saving reminder email (ADR-0026); on until the person turns it off. */
    weeklyReminder: boolean('weekly_reminder')
      .notNull()
      .default(sql`true`),
    /** The person's own Pip (handoff v2, "Meu Pip"): its look and an optional name. */
    pipHat: text('pip_hat').notNull().default(DEFAULT_PIP_LOOK.hat),
    pipOutfit: text('pip_outfit').notNull().default(DEFAULT_PIP_LOOK.outfit),
    pipBag: text('pip_bag').notNull().default(DEFAULT_PIP_LOOK.bag),
    pipBagColor: text('pip_bag_color').notNull().default(DEFAULT_PIP_LOOK.bagColor),
    pipName: text('pip_name'),
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
    check('user_preference_pip_hat_valid', oneOf(table.pipHat, PIP_HATS)),
    check('user_preference_pip_outfit_valid', oneOf(table.pipOutfit, PIP_OUTFITS)),
    check('user_preference_pip_bag_valid', oneOf(table.pipBag, PIP_BAGS)),
    check('user_preference_pip_bag_color_valid', oneOf(table.pipBagColor, PIP_BAG_COLORS)),
    check(
      'user_preference_pip_name_length',
      sql`${table.pipName} is null or (${table.pipName} = btrim(${table.pipName}) and char_length(${table.pipName}) between 1 and 16)`,
    ),
    check(
      'user_preference_home_point_valid',
      sql`(${table.homeLatitude} is null and ${table.homeLongitude} is null) or (${table.homeLatitude} between -90 and 90 and ${table.homeLongitude} between -180 and 180)`,
    ),
    check(
      'user_preference_home_city_length',
      sql`${table.homeCity} is null or (${table.homeCity} = btrim(${table.homeCity}) and char_length(${table.homeCity}) between 1 and 120)`,
    ),
  ],
);
