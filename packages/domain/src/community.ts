/**
 * The community (design handoff v2, "Community"): posts, comments, likes, follows. Rules owned by
 * docs/product/business-rules.md#community. Pure: the database applies the same visibility rule to feeds.
 */

/** What a post is about. Moments and tips are written; route, visa and goal posts carry a snapshot. */
export const POST_KINDS = ['moment', 'tip', 'route', 'visa', 'goal'] as const;
export type PostKind = (typeof POST_KINDS)[number];

/** Who may see a post: everyone in the community, or only the author's followers. */
export const POST_AUDIENCES = ['everyone', 'followers'] as const;
export type PostAudience = (typeof POST_AUDIENCES)[number];

/** Why a person reports a post. */
export const REPORT_REASONS = ['spam', 'abuse', 'unsafe', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const POST_BODY_MAX = 500;
export const COMMENT_BODY_MAX = 500;
/** Distinct reports that hide a post from everyone but its author until someone reviews it. */
export const REPORTS_TO_HIDE = 3;
/** Most posts and comments one person may write in a rolling day. */
export const POSTS_PER_DAY = 30;
export const COMMENTS_PER_DAY = 200;

/** Kinds that need words, because nothing else is attached. */
export const needsBody = (kind: PostKind): boolean => kind === 'moment' || kind === 'tip';

/** A handle: 3 to 24 of a-z, 0-9, dot and underscore; starts and ends with a letter or digit. */
const HANDLE = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/;
export const isHandle = (value: string): boolean => HANDLE.test(value);

/** A starting handle from the person's name: "Marina Duarte" → "marina.duarte". Never empty. */
export function handleFromName(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 20)
    .replace(/\.+$/g, '');
  return isHandle(base) ? base : 'traveler';
}

export interface PostAccess {
  readonly authorId: string;
  readonly audience: PostAudience;
  readonly deleted: boolean;
  readonly hidden: boolean;
}

export interface ViewerRelation {
  readonly viewerId: string;
  /** The viewer follows the author. */
  readonly follows: boolean;
  /** The viewer muted the author. */
  readonly muted: boolean;
  /** The viewer reported this post. */
  readonly reported: boolean;
}

/**
 * Whether a person sees a post. The author always sees their own (unless deleted). Everyone else needs it not
 * hidden by reports, not muted or reported by them, and either public or from someone they follow.
 */
export function canSeePost(post: PostAccess, viewer: ViewerRelation): boolean {
  if (post.deleted) return false;
  if (post.authorId === viewer.viewerId) return true;
  if (post.hidden || viewer.muted || viewer.reported) return false;
  return post.audience === 'everyone' || viewer.follows;
}
