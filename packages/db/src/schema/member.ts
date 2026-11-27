// People who plan a trip with its owner (ADR-0024). The owner stays in `trip.owner_id`; members join through an
// invite link. The link's token is never stored: only its SHA-256 hash, so a database read cannot join anyone.
import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const tripMember = pgTable(
  'trip_member',
  {
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** `editor` changes the plan; `viewer` only reads it. */
    role: text('role').notNull(),
    joinedAt: instant('joined_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tripId, table.userId] }),
    index('trip_member_user_id_idx').on(table.userId),
    check('trip_member_role_valid', sql`${table.role} in ('editor', 'viewer')`),
  ],
);

export const tripInvite = pgTable(
  'trip_invite',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /** SHA-256 of the link's token, hex. */
    tokenHash: text('token_hash').notNull().unique(),
    role: text('role').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    createdAt: instant('created_at').defaultNow().notNull(),
    expiresAt: instant('expires_at').notNull(),
    revokedAt: instant('revoked_at'),
  },
  (table) => [
    index('trip_invite_trip_id_idx').on(table.tripId),
    check('trip_invite_role_valid', sql`${table.role} in ('editor', 'viewer')`),
  ],
);
