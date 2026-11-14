// A trip's public link (docs/product/business-rules.md#sharing-a-trip). One per trip at most; stopping the share
// deletes the row, so the old link answers "not found" for good.
import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';

export const tripShare = pgTable(
  'trip_share',
  {
    /** 128 random bits, base64url: the whole secret of the link. */
    slug: text('slug').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .unique()
      .references(() => trip.id, { onDelete: 'cascade' }),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** Whether the page shows the trip's cost and savings amounts (off unless the owner turns it on). */
    showAmounts: boolean('show_amounts').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check('trip_share_slug_format', sql`${table.slug} ~ '^[A-Za-z0-9_-]{22}$'`)],
);
