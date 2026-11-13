'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { PostData } from '../../../../../lib/community';
import { CommunityProvider } from '../../community-context';
import { PostList } from '../../post-list';
import styles from '../../community.module.css';

export function PostPageView({
  post,
  currentTrip,
}: {
  post: PostData;
  currentTrip: { id: string; title: string } | null;
}) {
  const t = useTranslations('communityPage');
  return (
    <CommunityProvider currentTrip={currentTrip}>
      <div className={styles.page}>
        <main className={styles.column} aria-labelledby="post-title">
          <Link href="/app/community" className={styles.back}>
            <span aria-hidden="true">←</span> {t('postPage.back')}
          </Link>
          <h1 id="post-title" className={styles.srOnly}>
            {t('postPage.title')}
          </h1>
          <PostList
            initial={{ posts: [post], nextBefore: null }}
            load={async () => null}
            startOpen
            empty={
              <p className={styles.empty}>
                <Link href="/app/community">{t('postPage.back')}</Link>
              </p>
            }
          />
        </main>
      </div>
    </CommunityProvider>
  );
}
