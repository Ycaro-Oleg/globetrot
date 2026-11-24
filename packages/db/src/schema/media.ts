// Uploaded images. The bytes live in S3-compatible storage under `media/<id>`, already without metadata;
// this row says who owns them and what they are. Rules: docs/product/business-rules.md#photos.
import { IMAGE_TYPES } from '@globetrot/domain';
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth';

/** A photo placed somewhere (a post, a stop), with the words that describe it for people who cannot see it. */
export interface PhotoRef {
  readonly mediaId: string;
  readonly alt: string;
}

export const mediaAsset = pgTable(
  'media_asset',
  {
    id: uuid('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('media_asset_owner_id_idx').on(table.ownerId, table.createdAt),
    check(
      'media_asset_content_type_valid',
      sql`${table.contentType} in (${sql.raw(IMAGE_TYPES.map((type) => `'${type}'`).join(', '))})`,
    ),
    check('media_asset_byte_size_positive', sql`${table.byteSize} > 0`),
    check('media_asset_size_positive', sql`${table.width} > 0 and ${table.height} > 0`),
  ],
);
