// Pip's proposals and the AI usage they cost. A proposal is a change list the person previews, partly applies
// and can undo; nothing is changed by the model directly. Rules: docs/product/business-rules.md#ai-pip.
import { PROPOSAL_STATUSES } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });

export const aiProposal = pgTable(
  'ai_proposal',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /** What the person asked, as typed. Personal: never logged or audited. */
    request: text('request').notNull(),
    /** Pip's one-line summary of the change list. */
    summary: text('summary').notNull(),
    /** The validated change list (`PipChange[]`). */
    changes: jsonb('changes').$type<unknown[]>().notNull(),
    status: text('status').notNull().default('proposed'),
    /** Which changes were applied (indexes into `changes`). */
    applied: jsonb('applied').$type<number[]>().notNull().default([]),
    /** What undo needs: the state before applying and what applying created. */
    undo: jsonb('undo').$type<unknown>(),
    createdAt: instant('created_at').defaultNow().notNull(),
    decidedAt: instant('decided_at'),
  },
  (table) => [
    index('ai_proposal_trip_id_idx').on(table.tripId, table.createdAt),
    index('ai_proposal_owner_id_idx').on(table.ownerId, table.createdAt),
    check(
      'ai_proposal_status_valid',
      sql`${table.status} in (${sql.raw(PROPOSAL_STATUSES.map((s) => `'${s}'`).join(', '))})`,
    ),
    check('ai_proposal_request_length', sql`char_length(${table.request}) between 1 and 500`),
    check('ai_proposal_changes_array', sql`jsonb_typeof(${table.changes}) = 'array'`),
  ],
);

/** Tokens per request, per person: the basis for limits and cost. Kept when a trip goes, not with the account. */
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('ai_usage_user_id_idx').on(table.userId, table.createdAt),
    check(
      'ai_usage_tokens_positive',
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`,
    ),
  ],
);

/**
 * Each account's private address for forwarding bookings (ADR-0032): `{local}+{token}@{domain}`. Whoever knows
 * the token can send to the account, so it is long and random, and the inbound webhook is protected by a secret.
 */
export const inboundAddress = pgTable('inbound_address', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
