'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { FeedData, PersonPageData } from '../../../../../lib/community';
import { PipAvatar } from '../../../_components/pip-avatar';
import { loadPersonPosts, relate } from '../../actions';
import { CommunityProvider, useCommunity } from '../../community-context';
import { PostList } from '../../post-list';
import styles from '../../community.module.css';

export function PersonView({
  page,
  posts,
  currentTrip,
}: {
  page: PersonPageData;
  posts: FeedData;
  currentTrip: { id: string; title: string } | null;
}) {
  return (
    <CommunityProvider currentTrip={currentTrip}>
      <Person page={page} posts={posts} />
    </CommunityProvider>
  );
}

function Person({ page: initial, posts }: { page: PersonPageData; posts: FeedData }) {
  const t = useTranslations('communityPage');
  const { toast } = useCommunity();
  const router = useRouter();
  const [page, setPage] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { person } = page;

  const change = (which: 'follow' | 'mute', on: boolean) =>
    startTransition(async () => {
      const next = await relate(person.handle, which, on);
      if (!next) return toast(t('toasts.failed'));
      setPage(next);
      router.refresh();
      if (which === 'mute' && on) toast(t('toasts.muted', { name: person.name }));
    });

  return (
    <div className={styles.page}>
      <main className={styles.column} aria-labelledby="person-title">
        <Link href="/app/community" className={styles.back}>
          <span aria-hidden="true">←</span> {t('person.back')}
        </Link>
        <header className={styles.personHead}>
          <PipAvatar size={96} look={person.pipLook} />
          <div>
            <h1 id="person-title" className={styles.title}>
              {person.name}
            </h1>
            <p className={styles.postHandle}>@{person.handle}</p>
            <p className={styles.counts}>
              <span>{t('person.posts', { count: page.posts })}</span>
              <span>{t('person.followers', { count: page.followers })}</span>
              <span>{t('person.followingCount', { count: page.following })}</span>
            </p>
          </div>
          {page.mine ? (
            <p className={styles.muted}>{t('person.yours')}</p>
          ) : (
            <div className={styles.row}>
              <button
                type="button"
                className={page.followed ? styles.ghost : styles.primary}
                aria-pressed={page.followed}
                disabled={pending}
                onClick={() => change('follow', !page.followed)}
              >
                {page.followed ? t('person.unfollow') : t('person.follow')}
              </button>
              <button
                type="button"
                className={styles.ghost}
                aria-pressed={page.muted}
                disabled={pending}
                onClick={() => change('mute', !page.muted)}
              >
                {page.muted ? t('person.unmute') : t('person.mute')}
              </button>
            </div>
          )}
        </header>
        {page.muted ? <p className={styles.note}>{t('person.mutedNote')}</p> : null}
        <PostList
          key={`${page.followed}-${page.muted}`}
          initial={posts}
          load={(before) => loadPersonPosts(person.handle, before)}
          empty={<p className={styles.empty}>{t('person.empty')}</p>}
        />
      </main>
    </div>
  );
}
