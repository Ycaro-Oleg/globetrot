'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type ReactNode } from 'react';
import type { FeedData, PostData } from '../../../lib/community';
import { PostCard } from './post-card';
import styles from './community.module.css';

/**
 * A page of posts and "Show more". Posts the person deletes, mutes or reports leave the list at once and come
 * back on Undo; following someone updates every post of theirs on screen.
 */
export function PostList({
  initial,
  load,
  empty,
  added = [],
  startOpen = false,
}: {
  initial: FeedData;
  /** The next page, older than `before`. */
  load: (before: string) => Promise<FeedData | null>;
  empty: ReactNode;
  /** Posts published here since the page loaded, newest first. */
  added?: readonly PostData[];
  startOpen?: boolean;
}) {
  const t = useTranslations('communityPage');
  const [posts, setPosts] = useState<PostData[]>(initial.posts);
  const [next, setNext] = useState(initial.nextBefore);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [following, setFollowing] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [pending, startTransition] = useTransition();

  const all = [...added.filter((post) => !posts.some((p) => p.id === post.id)), ...posts];
  const shown = all.filter(
    (post) => !hidden.has(post.id) && !hidden.has(`author:${post.author.handle}`),
  );

  return (
    <>
      {shown.length === 0 ? (
        empty
      ) : (
        <ol className={styles.posts}>
          {shown.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                following={following.get(post.author.handle)}
                startOpen={startOpen}
                onHide={(key) => setHidden((set) => new Set(set).add(key))}
                onUnhide={(key) =>
                  setHidden((set) => {
                    const copy = new Set(set);
                    copy.delete(key);
                    return copy;
                  })
                }
                onAuthorChange={(handle, change) => {
                  if (change.following !== undefined) {
                    setFollowing((map) => new Map(map).set(handle, change.following!));
                  }
                }}
              />
            </li>
          ))}
        </ol>
      )}
      {next ? (
        <button
          type="button"
          className={styles.loadMore}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const page = await load(next);
              if (!page) return;
              setPosts((current) => [
                ...current,
                ...page.posts.filter((post) => !current.some((p) => p.id === post.id)),
              ]);
              setNext(page.nextBefore);
            })
          }
        >
          {pending ? t('loading') : t('loadMore')}
        </button>
      ) : null}
    </>
  );
}
