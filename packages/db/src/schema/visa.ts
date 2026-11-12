// Commemorative Globetrot visas: one per person and country, stamped when they first mark a stop there visited.
// Decorative, never an official document (business rules, "Passport"). Conventions: docs/architecture/data-model.md.
import { sql } from 'drizzle-orm';
import { char, check, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visa = pgTable(
  'visa',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** ISO 3166-1 alpha-2. */
    countryCode: char('country_code', { length: 2 }).notNull(),
    /** The stop that stamped it, as named on the route. Personal: never logged or audited. */
    city: text('city').notNull(),
    stampedAt: timestamp('stamped_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.countryCode] }),
    check('visa_country_format', sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    check('visa_city_length', sql`char_length(${table.city}) between 1 and 200`),
  ],
);
