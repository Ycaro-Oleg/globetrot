// A trip's places to see, each on a day or not yet ("No day"). Conventions: docs/architecture/data-model.md.
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const tripPlace = pgTable(
  'trip_place',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /**
     * The stop it belongs to. Deliberately not a foreign key: the route is saved as a whole (its rows are replaced),
     * and a place must survive that. A stop that no longer exists reads as "no stop".
     */
    destinationId: uuid('destination_id'),
    name: text('name').notNull(),
    /** Estimated time there, in minutes. */
    minutes: integer('minutes').notNull(),
    /** 1-based trip day, or null while it has no day. A day past the end of the route reads as no day. */
    day: integer('day'),
    /** Order across the trip; within a day the places read in this order. */
    position: integer('position').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('trip_place_trip_id_position_idx').on(table.tripId, table.position),
    check(
      'trip_place_name_length',
      sql`${table.name} = btrim(${table.name}) and char_length(${table.name}) between 1 and 120`,
    ),
    check('trip_place_minutes_range', sql`${table.minutes} between 15 and 720`),
    check('trip_place_day_positive', sql`${table.day} is null or ${table.day} >= 1`),
    check('trip_place_position_not_negative', sql`${table.position} >= 0`),
  ],
);
