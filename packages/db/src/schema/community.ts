// The community (design handoff v2, "Community"): handles, posts, comments, likes, saves, follows, mutes and
// reports. Rules: docs/product/business-rules.md#community. Conventions: docs/architecture/data-model.md.
import { POST_AUDIENCES, POST_KINDS, REPORT_REASONS } from '@globetrot/domain';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  char,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

const instant = (name: string) => timestamp(name, { withTimezone: true });
const oneOf = (column: AnyColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`;
const userRef = (name: string) =>
  text(name)
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' });

/** A person's public name in the community. Created the first time they act there. */
export const communityProfile = pgTable(
  'community_profile',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    handle: text('handle').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('community_profile_handle_key').on(table.handle),
    check(
      'community_profile_handle_format',
      sql`${table.handle} ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'`,
    ),
  ],
);

/** What a route, visa or goal post shows, copied when it was published (never a live link to a private trip). */
export type PostAttachment =
  | {
      readonly kind: 'route';
      readonly title: string;
      readonly nights: number;
      readonly stops: readonly {
        readonly placeKey: string;
        readonly name: string;
        readonly countryCode: string | null;
        readonly region: string | null;
        readonly latitude: number;
        readonly longitude: number;
        readonly nights: number;
      }[];
      /** The planned total (major units, exact), only when the author chose to show it. */
      readonly total: { readonly amount: string; readonly currency: string } | null;
    }
  | {
      readonly kind: 'visa';
      readonly countryCode: string;
      readonly city: string;
      readonly stampedAt: string;
      /** Which country this was in the author's passport (1-based). */
      readonly ordinal: number;
    }
  | {
      readonly kind: 'goal';
      readonly tripTitle: string;
      /** `YYYY-MM`. */
      readonly readyMonth: string;
      /** Already fully saved (otherwise: on track for `readyMonth`). */
      readonly reached: boolean;
    };

export const post = pgTable(
  'post',
  {
    id: uuid('id').primaryKey(),
    authorId: userRef('author_id'),
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    placeName: text('place_name'),
    placeCountry: char('place_country', { length: 2 }),
    audience: text('audience').notNull(),
    attachment: jsonb('attachment').$type<PostAttachment>(),
    createdAt: instant('created_at').defaultNow().notNull(),
    editedAt: instant('edited_at'),
    /** Deleted by the author (restorable). */
    deletedAt: instant('deleted_at'),
    /** Hidden by reports until someone reviews it. */
    hiddenAt: instant('hidden_at'),
  },
  (table) => [
    index('post_author_id_idx').on(table.authorId, table.id),
    index('post_created_at_idx').on(table.createdAt),
    check('post_kind_valid', oneOf(table.kind, POST_KINDS)),
    check('post_audience_valid', oneOf(table.audience, POST_AUDIENCES)),
    check(
      'post_body_length',
      sql`${table.body} = btrim(${table.body}) and char_length(${table.body}) <= 500`,
    ),
    check(
      'post_place_name_length',
      sql`${table.placeName} is null or (${table.placeName} = btrim(${table.placeName}) and char_length(${table.placeName}) between 1 and 120)`,
    ),
    check(
      'post_place_country_format',
      sql`${table.placeCountry} is null or ${table.placeCountry} ~ '^[A-Z]{2}$'`,
    ),
  ],
);

export const postComment = pgTable(
  'post_comment',
  {
    id: uuid('id').primaryKey(),
    postId: uuid('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    authorId: userRef('author_id'),
    body: text('body').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
    deletedAt: instant('deleted_at'),
  },
  (table) => [
    index('post_comment_post_id_idx').on(table.postId, table.id),
    index('post_comment_author_id_idx').on(table.authorId, table.createdAt),
    check(
      'post_comment_body_length',
      sql`${table.body} = btrim(${table.body}) and char_length(${table.body}) between 1 and 500`,
    ),
  ],
);

export const postLike = pgTable(
  'post_like',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    userId: userRef('user_id'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.userId] }),
    index('post_like_user_id_idx').on(table.userId),
  ],
);

/** A post the person bookmarked. Private: only they know. */
export const postSave = pgTable(
  'post_save',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    userId: userRef('user_id'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.userId] })],
);

export const commentLike = pgTable(
  'comment_like',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => postComment.id, { onDelete: 'cascade' }),
    userId: userRef('user_id'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.commentId, table.userId] })],
);

export const follow = pgTable(
  'follow',
  {
    followerId: userRef('follower_id'),
    followeeId: userRef('followee_id'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followeeId] }),
    index('follow_followee_id_idx').on(table.followeeId),
    check('follow_not_self', sql`${table.followerId} <> ${table.followeeId}`),
  ],
);

/** People someone chose not to see. Private: the muted person is never told. */
export const mute = pgTable(
  'mute',
  {
    userId: userRef('user_id'),
    mutedId: userRef('muted_id'),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mutedId] }),
    check('mute_not_self', sql`${table.userId} <> ${table.mutedId}`),
  ],
);

/** One report per person and post, kept for review. */
export const postReport = pgTable(
  'post_report',
  {
    postId: uuid('post_id')
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    reporterId: userRef('reporter_id'),
    reason: text('reason').notNull(),
    createdAt: instant('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.reporterId] }),
    check('post_report_reason_valid', oneOf(table.reason, REPORT_REASONS)),
  ],
);
