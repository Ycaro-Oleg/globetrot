import {
  COMMENT_BODY_MAX,
  isHandle,
  POST_PHOTOS_MAX,
  POST_AUDIENCES,
  POST_BODY_MAX,
  POST_KINDS,
  REPORT_REASONS,
} from '@globetrot/domain';
import { z } from 'zod';
import { moneySchema } from '../budget/schemas';
import { photoFields, photoSchema } from '../media/schemas';
import { pipLookSchema } from '../preferences/schemas';

export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isHandle, {
    error:
      'A handle is 3 to 24 of a-z, 0-9, dot and underscore, starting and ending with a letter or digit',
  })
  .meta({ example: 'ana.mochila' });

export const personSchema = z.object({
  handle: z.string(),
  name: z.string(),
  pipLook: pipLookSchema,
});
export type PersonView = z.infer<typeof personSchema>;

const routeAttachment = z.object({
  kind: z.literal('route'),
  title: z.string(),
  nights: z.number().int(),
  stops: z.array(
    z.object({ name: z.string(), countryCode: z.string().nullable(), nights: z.number().int() }),
  ),
  /** The planned total, labelled an estimate; null when the author hid amounts. */
  total: moneySchema.nullable(),
});
const visaAttachment = z.object({
  kind: z.literal('visa'),
  countryCode: z.string(),
  city: z.string(),
  stampedAt: z.iso.datetime(),
  /** Which country this was in the author's passport (1-based). */
  ordinal: z.number().int(),
});
const goalAttachment = z.object({
  kind: z.literal('goal'),
  tripTitle: z.string(),
  /** `YYYY-MM`. Amounts are never shared. */
  readyMonth: z.string(),
  reached: z.boolean(),
});
export const attachmentSchema = z.discriminatedUnion('kind', [
  routeAttachment,
  visaAttachment,
  goalAttachment,
]);

export const postSchema = z.object({
  id: z.uuid(),
  kind: z.enum(POST_KINDS),
  body: z.string(),
  place: z.object({ name: z.string(), countryCode: z.string().nullable() }).nullable(),
  audience: z.enum(POST_AUDIENCES),
  attachment: attachmentSchema.nullable(),
  /** Up to four photos (moments and tips); `GET /v1/media/{mediaId}` serves each to whoever may see the post. */
  photos: z.array(photoSchema),
  createdAt: z.iso.datetime(),
  editedAt: z.iso.datetime().nullable(),
  author: personSchema,
  /** Written by the viewer. */
  mine: z.boolean(),
  /** The viewer follows the author. */
  following: z.boolean(),
  likes: z.number().int(),
  liked: z.boolean(),
  saved: z.boolean(),
  comments: z.number().int(),
  /** Someone the viewer follows who liked it. */
  likedBy: personSchema.nullable(),
});
export type PostView = z.infer<typeof postSchema>;

export const feedSchema = z.object({
  posts: z.array(postSchema),
  /** Pass as `before` for the next page; null at the end. */
  nextBefore: z.uuid().nullable(),
});
export type FeedView = z.infer<typeof feedSchema>;

export const commentSchema = z.object({
  id: z.uuid(),
  body: z.string(),
  createdAt: z.iso.datetime(),
  author: personSchema,
  mine: z.boolean(),
  /** The viewer wrote it or wrote the post. */
  canDelete: z.boolean(),
  likes: z.number().int(),
  liked: z.boolean(),
});
export const commentListSchema = z.object({ comments: z.array(commentSchema) });
export type CommentView = z.infer<typeof commentSchema>;

export const personPageSchema = z.object({
  person: personSchema,
  posts: z.number().int(),
  followers: z.number().int(),
  following: z.number().int(),
  /** The viewer follows this person. */
  followed: z.boolean(),
  muted: z.boolean(),
  mine: z.boolean(),
});
export type PersonPageView = z.infer<typeof personPageSchema>;

export const communityMeSchema = z.object({
  /** Null until the person first acts in the community. */
  handle: z.string().nullable(),
  /** What the handle will be when they join. */
  suggestedHandle: z.string(),
  posts: z.number().int(),
  followers: z.number().int(),
  following: z.number().int(),
});
export type CommunityMeView = z.infer<typeof communityMeSchema>;

export const discoverSchema = z.object({
  suggestions: z.array(z.object({ person: personSchema, posts: z.number().int() })),
  trending: z.array(z.object({ countryCode: z.string(), posts: z.number().int() })),
});
export type DiscoverView = z.infer<typeof discoverSchema>;

export const feedQuery = z.object({
  feed: z.enum(['all', 'following']).default('all'),
  before: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createPostFields = z.object({
  kind: z.enum(POST_KINDS),
  body: z.string().trim().max(POST_BODY_MAX).default(''),
  place: z
    .object({
      name: z.string().trim().min(1).max(120),
      countryCode: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .nullable()
        .optional(),
    })
    .nullable()
    .optional(),
  audience: z.enum(POST_AUDIENCES).default('everyone'),
  /** The trip to share, for a route or goal post. */
  tripId: z.uuid().optional(),
  /** Route posts: show the planned total (off unless asked). */
  showAmounts: z.boolean().default(false),
  /** Moments and tips: up to four images the caller uploaded (`POST /v1/media`). */
  photos: z.array(photoFields).max(POST_PHOTOS_MAX).default([]),
  /** Visa posts: which of the person's visas. */
  visaCountry: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});

export const updatePostFields = z.object({
  body: z.string().trim().max(POST_BODY_MAX),
});

export const commentFields = z.object({
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX),
});

export const reportFields = z.object({ reason: z.enum(REPORT_REASONS) });

export const toggleFields = z.object({ on: z.boolean() });

export const updateHandleFields = z.object({ handle: handleSchema });
