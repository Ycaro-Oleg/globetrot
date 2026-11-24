'use server';

import { cookies } from 'next/headers';
import type {
  CommentData,
  FeedData,
  FeedName,
  PersonPageData,
  PostData,
} from '../../../lib/community';
import { actionApiClient } from '../../../lib/action-client';
import { SELECTED_TRIP_COOKIE } from '../../../lib/trips';

const apiClient = actionApiClient;

/** What a failed write says: the API's problem code, so the screen can pick the right words. */
export type Failure = { error: string };
const failure = (error: unknown): Failure => ({
  error:
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : 'UNKNOWN',
});

export interface NewPost {
  kind: PostData['kind'];
  body: string;
  place: { name: string; countryCode: string | null } | null;
  audience: PostData['audience'];
  tripId?: string;
  showAmounts?: boolean;
  visaCountry?: string;
  photos?: { mediaId: string; alt: string }[];
}

export async function publishPost(input: NewPost): Promise<PostData | Failure> {
  const client = await apiClient();
  if (!client) return { error: 'UNAUTHENTICATED' };
  const { data, error } = await client.POST('/v1/community/posts', {
    params: { header: { 'idempotency-key': crypto.randomUUID() } },
    body: {
      kind: input.kind,
      body: input.body,
      audience: input.audience,
      place: input.place,
      ...(input.tripId ? { tripId: input.tripId } : {}),
      ...(input.showAmounts ? { showAmounts: true } : {}),
      ...(input.visaCountry ? { visaCountry: input.visaCountry } : {}),
      ...(input.photos?.length ? { photos: input.photos } : {}),
    },
  });
  return data ?? failure(error);
}

export async function loadFeed(feed: FeedName, before?: string): Promise<FeedData | null> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.GET('/v1/community/feed', {
    params: { query: { feed, ...(before ? { before } : {}) } },
  });
  return data ?? null;
}

export async function loadPersonPosts(handle: string, before?: string): Promise<FeedData | null> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.GET('/v1/community/people/{handle}/posts', {
    params: { path: { handle }, query: before ? { before } : {} },
  });
  return data ?? null;
}

export async function editPost(postId: string, body: string): Promise<PostData | Failure> {
  const client = await apiClient();
  if (!client) return { error: 'UNAUTHENTICATED' };
  const { data, error } = await client.PATCH('/v1/community/posts/{postId}', {
    params: { path: { postId } },
    body: { body },
  });
  return data ?? failure(error);
}

export async function removePost(postId: string, restore = false): Promise<boolean> {
  const client = await apiClient();
  if (!client) return false;
  const path = { params: { path: { postId } } };
  const { data } = restore
    ? await client.POST('/v1/community/posts/{postId}/restore', path)
    : await client.DELETE('/v1/community/posts/{postId}', path);
  return data?.ok === true;
}

export async function react(
  postId: string,
  which: 'like' | 'save',
  on: boolean,
): Promise<PostData | null> {
  const client = await apiClient();
  if (!client) return null;
  const path = { params: { path: { postId } } };
  const { data } =
    which === 'like'
      ? on
        ? await client.PUT('/v1/community/posts/{postId}/like', path)
        : await client.DELETE('/v1/community/posts/{postId}/like', path)
      : on
        ? await client.PUT('/v1/community/posts/{postId}/save', path)
        : await client.DELETE('/v1/community/posts/{postId}/save', path);
  return data ?? null;
}

export async function loadComments(postId: string): Promise<CommentData[] | null> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.GET('/v1/community/posts/{postId}/comments', {
    params: { path: { postId } },
  });
  return data?.comments ?? null;
}

export async function addComment(postId: string, body: string): Promise<CommentData[] | Failure> {
  const client = await apiClient();
  if (!client) return { error: 'UNAUTHENTICATED' };
  const { error } = await client.POST('/v1/community/posts/{postId}/comments', {
    params: { path: { postId } },
    body: { body },
  });
  if (error) return failure(error);
  return (await loadComments(postId)) ?? { error: 'UNKNOWN' };
}

export async function removeComment(commentId: string, restore = false): Promise<boolean> {
  const client = await apiClient();
  if (!client) return false;
  const path = { params: { path: { commentId } } };
  const { data } = restore
    ? await client.POST('/v1/community/comments/{commentId}/restore', path)
    : await client.DELETE('/v1/community/comments/{commentId}', path);
  return data?.ok === true;
}

export async function likeComment(commentId: string, on: boolean): Promise<boolean> {
  const client = await apiClient();
  if (!client) return false;
  const path = { params: { path: { commentId } } };
  const { data } = on
    ? await client.PUT('/v1/community/comments/{commentId}/like', path)
    : await client.DELETE('/v1/community/comments/{commentId}/like', path);
  return data?.ok === true;
}

export async function relate(
  handle: string,
  which: 'follow' | 'mute',
  on: boolean,
): Promise<PersonPageData | null> {
  const client = await apiClient();
  if (!client) return null;
  const path = { params: { path: { handle } } };
  const { data } =
    which === 'follow'
      ? on
        ? await client.PUT('/v1/community/people/{handle}/follow', path)
        : await client.DELETE('/v1/community/people/{handle}/follow', path)
      : on
        ? await client.PUT('/v1/community/people/{handle}/mute', path)
        : await client.DELETE('/v1/community/people/{handle}/mute', path);
  return data ?? null;
}

export async function report(
  postId: string,
  reason: 'spam' | 'abuse' | 'unsafe' | 'other',
): Promise<boolean> {
  const client = await apiClient();
  if (!client) return false;
  const { data } = await client.POST('/v1/community/posts/{postId}/report', {
    params: { path: { postId } },
    body: { reason },
  });
  return data?.ok === true;
}

/** Copies a shared route into a new trip and makes it the current trip. Answers its title, or null. */
export async function copyRoute(postId: string): Promise<string | null> {
  const client = await apiClient();
  if (!client) return null;
  const { data } = await client.POST('/v1/community/posts/{postId}/copy-route', {
    params: { path: { postId }, header: { 'idempotency-key': crypto.randomUUID() } },
  });
  if (!data) return null;
  (await cookies()).set(SELECTED_TRIP_COOKIE, data.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return data.title;
}

/** Saves a post's place to the current trip's "No day". */
export async function savePlace(tripId: string, name: string): Promise<boolean> {
  const client = await apiClient();
  if (!client) return false;
  const { data } = await client.POST('/v1/trips/{id}/day-places', {
    params: { path: { id: tripId } },
    body: { name: name.slice(0, 120), minutes: 60 },
  });
  return data !== undefined;
}

export async function changeHandle(handle: string): Promise<string | Failure> {
  const client = await apiClient();
  if (!client) return { error: 'UNAUTHENTICATED' };
  const { data, error } = await client.PATCH('/v1/community/me', { body: { handle } });
  return data?.handle ?? failure(error);
}
