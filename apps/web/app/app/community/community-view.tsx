'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type FormEvent } from 'react';
import type {
  CommunityMeData,
  DiscoverData,
  FeedData,
  FeedName,
  PostData,
} from '../../../lib/community';
import { PipAvatar } from '../_components/pip-avatar';
import { changeHandle, loadFeed, relate } from './actions';
import { CommunityProvider, useCommunity } from './community-context';
import { Composer, type ComposerPlace, type ComposerTrip } from './composer';
import { useCountryName } from './post-card';
import { PostList } from './post-list';
import styles from './community.module.css';

/**
 * The community (design handoff v2): a 600 px timeline with "For you" and "Following", the inline composer, and
 * a light right column (who to follow, trending destinations, the person's handle) from 1000 px. On a phone the
 * suggestions become a strip in "For you" and a coral "+" opens the composer.
 */
export function CommunityView(props: {
  feedName: FeedName;
  feed: FeedData | null;
  discover: DiscoverData | null;
  me: CommunityMeData | null;
  trips: readonly ComposerTrip[];
  currentTrip: ComposerTrip | null;
  visas: readonly { countryCode: string; city: string }[];
  places: readonly ComposerPlace[];
}) {
  return (
    <CommunityProvider currentTrip={props.currentTrip}>
      <Feed {...props} />
    </CommunityProvider>
  );
}

function Feed({
  feedName,
  feed,
  discover,
  me,
  trips,
  visas,
  places,
}: Parameters<typeof CommunityView>[0]) {
  const t = useTranslations('communityPage');
  const [added, setAdded] = useState<PostData[]>([]);
  const composer = useRef<HTMLTextAreaElement>(null);
  const tabs: { name: FeedName; label: string; href: string }[] = [
    { name: 'all', label: t('forYou'), href: '/app/community' },
    { name: 'following', label: t('following'), href: '/app/community?feed=following' },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.column} aria-labelledby="community-title">
        <h1 id="community-title" className={styles.title}>
          {t('title')}
        </h1>
        <nav className={styles.tabs} aria-label={t('feedsLabel')}>
          {tabs.map((tab) => (
            <Link
              key={tab.name}
              href={tab.href}
              aria-current={feedName === tab.name ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <Composer
          ref={composer}
          trips={trips}
          visas={visas}
          places={places}
          onPosted={(post) => setAdded((list) => [post, ...list])}
        />
        {feedName === 'all' && discover && discover.suggestions.length > 0 ? (
          <Suggestions discover={discover} variant="strip" />
        ) : null}
        {feed ? (
          <PostList
            key={feedName}
            initial={feed}
            added={added}
            load={(before) => loadFeed(feedName, before)}
            empty={
              <div className={styles.empty}>
                <PipAvatar size={72} pose="draft" still />
                <h2>
                  {feedName === 'following' ? t('empty.followingTitle') : t('empty.allTitle')}
                </h2>
                <p>{feedName === 'following' ? t('empty.followingBody') : t('empty.allBody')}</p>
                {feedName === 'following' ? (
                  <Link href="/app/community" className={styles.primaryLink}>
                    {t('empty.discover')}
                  </Link>
                ) : null}
              </div>
            }
          />
        ) : (
          <p className={styles.error} role="alert">
            {t('toasts.failed')}
          </p>
        )}
      </main>
      <aside className={styles.aside} aria-label={t('aside.whoFollow')}>
        <You me={me} />
        {discover ? <Suggestions discover={discover} variant="column" /> : null}
        {discover ? <Trending trending={discover.trending} /> : null}
        <p className={styles.note}>{t('aside.rules')}</p>
      </aside>
      <button
        type="button"
        className={styles.fab}
        aria-label={t('fab')}
        onClick={() => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          composer.current?.focus();
        }}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function Suggestions({
  discover,
  variant,
}: {
  discover: DiscoverData;
  variant: 'strip' | 'column';
}) {
  const t = useTranslations('communityPage');
  const { toast } = useCommunity();
  const [followed, setFollowed] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const list = (
    <ul className={variant === 'strip' ? styles.strip : styles.people}>
      {discover.suggestions.map(({ person, posts }) => {
        const on = followed.has(person.handle);
        return (
          <li key={person.handle}>
            <PipAvatar size={40} look={person.pipLook} still />
            <span className={styles.personText}>
              <Link href={`/app/community/u/${person.handle}`}>{person.name}</Link>
              <span>
                @{person.handle} · {t('aside.posts', { count: posts })}
              </span>
            </span>
            <button
              type="button"
              className={on ? styles.ghost : styles.primary}
              aria-pressed={on}
              aria-label={`${on ? t('post.followingBtn') : t('post.follow')}: ${person.name}`}
              onClick={() =>
                startTransition(async () => {
                  const result = await relate(person.handle, 'follow', !on);
                  if (!result) return toast(t('toasts.failed'));
                  setFollowed((set) => {
                    const next = new Set(set);
                    if (result.followed) next.add(person.handle);
                    else next.delete(person.handle);
                    return next;
                  });
                  toast(
                    result.followed
                      ? t('toasts.followed', { name: person.name })
                      : t('toasts.unfollowed', { name: person.name }),
                  );
                })
              }
            >
              {on ? t('post.followingBtn') : t('post.follow')}
            </button>
          </li>
        );
      })}
    </ul>
  );
  if (variant === 'strip') {
    return (
      <section className={styles.stripWrap} aria-label={t('aside.whoFollow')}>
        {list}
      </section>
    );
  }
  return (
    <section className={styles.asideBox}>
      <h2>{t('aside.whoFollow')}</h2>
      {discover.suggestions.length > 0 ? list : <p className={styles.muted}>{t('aside.nobody')}</p>}
    </section>
  );
}

function Trending({ trending }: { trending: DiscoverData['trending'] }) {
  const t = useTranslations('communityPage.aside');
  const country = useCountryName();
  return (
    <section className={styles.asideBox}>
      <h2>{t('trending')}</h2>
      {trending.length > 0 ? (
        <ol className={styles.trending}>
          {trending.map((entry) => (
            <li key={entry.countryCode}>
              <strong>{country(entry.countryCode)}</strong>
              <span>{t('posts', { count: entry.posts })}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>{t('noTrending')}</p>
      )}
    </section>
  );
}

/** The person's own handle: shown once they joined, editable here. */
function You({ me }: { me: CommunityMeData | null }) {
  const t = useTranslations('communityPage.aside');
  const [handle, setHandle] = useState(me?.handle ?? '');
  const [saved, setSaved] = useState(me?.handle ?? null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  if (!me) return null;

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await changeHandle(handle);
      if (typeof result !== 'string') return setStatus('error');
      setSaved(result);
      setHandle(result);
      setStatus('saved');
    });
  }

  return (
    <section className={styles.asideBox}>
      <h2>{t('you')}</h2>
      {saved ? (
        <form className={styles.handleForm} onSubmit={submit}>
          <label htmlFor="community-handle">{t('handle')}</label>
          <span className={styles.handleInput}>
            <span aria-hidden="true">@</span>
            <input
              id="community-handle"
              value={handle}
              maxLength={24}
              aria-describedby="community-handle-help"
              onChange={(event) => {
                setHandle(event.target.value);
                setStatus('idle');
              }}
            />
          </span>
          <small id="community-handle-help">{t('handleHelp')}</small>
          <button
            type="submit"
            className={styles.ghost}
            disabled={pending || handle.trim().toLowerCase() === saved}
          >
            {t('handleSave')}
          </button>
          <p role="status" className={status === 'error' ? styles.error : styles.muted}>
            {status === 'saved' ? t('handleSaved') : status === 'error' ? t('handleTaken') : ''}
          </p>
          <Link href={`/app/community/u/${saved}`} className={styles.textLink}>
            @{saved}
          </Link>
        </form>
      ) : (
        <p className={styles.muted}>{t('notJoined')}</p>
      )}
    </section>
  );
}
