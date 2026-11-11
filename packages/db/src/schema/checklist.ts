// A trip's checklists: items in four groups, each done or not. Conventions: docs/architecture/data-model.md.
import { CHECKLIST_GROUPS } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { trip } from './trip';

const instant = (name: string) => timestamp(name, { withTimezone: true });
const groups = sql.raw(CHECKLIST_GROUPS.map((group) => `'${group}'`).join(', '));

export const checklistItem = pgTable(
  'checklist_item',
  {
    id: uuid('id').primaryKey(),
    tripId: uuid('trip_id')
      .notNull()
      .references(() => trip.id, { onDelete: 'cascade' }),
    /** `documents`, `money`, `bookings` or `packing`. */
    group: text('group').notNull(),
    label: text('label').notNull(),
    done: boolean('done')
      .notNull()
      .default(sql`false`),
    createdAt: instant('created_at').defaultNow().notNull(),
    updatedAt: instant('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('checklist_item_trip_id_created_at_idx').on(table.tripId, table.createdAt),
    check('checklist_item_group_valid', sql`${table.group} in (${groups})`),
    check(
      'checklist_item_label_length',
      sql`${table.label} = btrim(${table.label}) and char_length(${table.label}) between 1 and 120`,
    ),
  ],
);
