import type { paths } from '@globetrot/api-client';
import { createServerApiClient, type FetchOptions } from './stored-preferences';

type Json<P extends keyof paths, M extends 'get' | 'post' | 'put' | 'patch'> = paths[P] extends {
  [K in M]: { responses: { 200: { content: { 'application/json': infer T } } } };
}
  ? T
  : never;

export type FeedData = Json<'/v1/community/feed', 'get'>;
export type PostData = FeedData['posts'][number];
export type PersonData = PostData['author'];
export type CommentData = Json<'/v1/community/posts/{postId}/comments', 'get'>['comments'][number];
export type DiscoverData = Json<'/v1/community/discover', 'get'>;
export type CommunityMeData = Json<'/v1/community/me', 'get'>;
export type PersonPageData = Json<'/v1/community/people/{handle}', 'get'>;
export type FeedName = 'all' | 'following';

async function safely<T>(work: () => Promise<{ data?: T }>): Promise<T | null> {
  try {
    return (await work()).data ?? null;
  } catch {
    return null;
  }
}

export const fetchFeed = (options: FetchOptions, feed: FeedName) =>
  safely(() =>
    createServerApiClient(options).GET('/v1/community/feed', { params: { query: { feed } } }),
  );

export const fetchDiscover = (options: FetchOptions) =>
  safely(() => createServerApiClient(options).GET('/v1/community/discover'));

export const fetchCommunityMe = (options: FetchOptions) =>
  safely(() => createServerApiClient(options).GET('/v1/community/me'));

export const fetchPost = (options: FetchOptions, postId: string) =>
  safely(() =>
    createServerApiClient(options).GET('/v1/community/posts/{postId}', {
      params: { path: { postId } },
    }),
  );

export const fetchComments = (options: FetchOptions, postId: string) =>
  safely(() =>
    createServerApiClient(options).GET('/v1/community/posts/{postId}/comments', {
      params: { path: { postId } },
    }),
  );

export const fetchPerson = (options: FetchOptions, handle: string) =>
  safely(() =>
    createServerApiClient(options).GET('/v1/community/people/{handle}', {
      params: { path: { handle } },
    }),
  );

export const fetchPersonPosts = (options: FetchOptions, handle: string) =>
  safely(() =>
    createServerApiClient(options).GET('/v1/community/people/{handle}/posts', {
      params: { path: { handle }, query: {} },
    }),
  );
