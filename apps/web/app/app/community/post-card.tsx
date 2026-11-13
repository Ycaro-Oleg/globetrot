'use client';

import { DEFAULT_PIP_LOOK } from '@globetrot/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import type { CommentData, PostData } from '../../../lib/community';
import { PipAvatar } from '../_components/pip-avatar';
import {
  addComment,
  copyRoute,
  editPost,
  likeComment,
  loadComments,
  react,
  relate,
  removeComment,
  removePost,
  report,
  savePlace,
} from './actions';
import { useCommunity } from './community-context';
import styles from './community.module.css';

const REPORT_REASONS = ['spam', 'abuse', 'unsafe', 'other'] as const;

/** "3 min ago", "yesterday": relative to now, in the person's language. */
export function useRelativeTime() {
  const locale = useLocale();
  const t = useTranslations('communityPage');
  return (iso: string) => {
    const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return t('now');
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    if (minutes < 60) return format.format(-minutes, 'minute');
    if (minutes < 1440) return format.format(-Math.round(minutes / 60), 'hour');
    if (minutes < 43200) return format.format(-Math.round(minutes / 1440), 'day');
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso));
  };
}

export function useCountryName() {
  const locale = useLocale();
  return (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * One post as a timeline row (design handoff v2, "Community"): Pip, name, handle and time; the words, the place
 * chip and what is attached (route, visa, goal); like, comment, save and share. Own posts can be edited and
 * deleted (with Undo); others can be followed, muted (with Undo) and reported.
 */
export function PostCard({
  post: initial,
  onHide,
  onUnhide,
  onAuthorChange,
  startOpen = false,
  following: followingOverride,
}: {
  post: PostData;
  /** Whether the person follows the author, when it changed elsewhere on the screen. */
  following?: boolean | undefined;
  /** Hide from the list: a post id, or `author:<handle>` for every post of a muted person. */
  onHide?: (key: string) => void;
  /** Undo of `onHide`. */
  onUnhide?: (key: string) => void;
  /** Following or muting the author changes every post of theirs on screen. */
  onAuthorChange?: (handle: string, change: { following?: boolean }) => void;
  startOpen?: boolean;
}) {
  const t = useTranslations('communityPage');
  const locale = useLocale();
  const { toast, currentTrip } = useCommunity();
  const when = useRelativeTime();
  const country = useCountryName();
  const [post, setPost] = useState(initial);
  const isFollowing = followingOverride ?? post.following;
  const [menu, setMenu] = useState<'closed' | 'open' | 'report'>('closed');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [commentsOpen, setCommentsOpen] = useState(startOpen);
  const [placeSaved, setPlaceSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, startTransition] = useTransition();
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const name = firstName(post.author.name);
  const profileHref = `/app/community/u/${post.author.handle}`;

  useEffect(() => {
    if (menu === 'closed') return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setMenu('closed');
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu('closed');
        menuButton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const failed = () => toast(t('toasts.failed'));

  function toggle(which: 'like' | 'save') {
    const on = which === 'like' ? !post.liked : !post.saved;
    const before = post;
    setPost((current) =>
      which === 'like'
        ? { ...current, liked: on, likes: current.likes + (on ? 1 : -1) }
        : { ...current, saved: on },
    );
    startTransition(async () => {
      const next = await react(post.id, which, on);
      if (next) setPost(next);
      else {
        setPost(before);
        failed();
      }
    });
  }

  function follow(on: boolean) {
    setMenu('closed');
    startTransition(async () => {
      const person = await relate(post.author.handle, 'follow', on);
      if (!person) return failed();
      onAuthorChange?.(post.author.handle, { following: person.followed });
      setPost((current) => ({ ...current, following: person.followed }));
      if (on) toast(t('toasts.followed', { name }));
      else
        toast(t('toasts.unfollowed', { name }), () => {
          void relate(post.author.handle, 'follow', true).then((again) => {
            if (again) {
              onAuthorChange?.(post.author.handle, { following: true });
              setPost((current) => ({ ...current, following: true }));
            }
          });
        });
    });
  }

  function remove() {
    setMenu('closed');
    startTransition(async () => {
      if (!(await removePost(post.id))) return failed();
      onHide?.(post.id);
      toast(t('toasts.deleted'), () => {
        void removePost(post.id, true).then((ok) => (ok ? onUnhide?.(post.id) : failed()));
      });
    });
  }

  function mute() {
    setMenu('closed');
    startTransition(async () => {
      if (!(await relate(post.author.handle, 'mute', true))) return failed();
      const key = `author:${post.author.handle}`;
      onHide?.(key);
      toast(t('toasts.muted', { name }), () => {
        void relate(post.author.handle, 'mute', false).then((again) =>
          again ? onUnhide?.(key) : failed(),
        );
      });
    });
  }

  function sendReport(reason: (typeof REPORT_REASONS)[number]) {
    setMenu('closed');
    startTransition(async () => {
      if (!(await report(post.id, reason))) return failed();
      onHide?.(post.id);
      toast(t('toasts.reported'));
    });
  }

  async function copyLink() {
    setMenu('closed');
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/community/p/${post.id}`);
      toast(t('toasts.linkCopied'));
    } catch {
      failed();
    }
  }

  function saveEdit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const next = await editPost(post.id, draft.trim());
      if ('error' in next) return failed();
      setPost(next);
      setEditing(false);
    });
  }

  const attachment = post.attachment;
  const savable =
    !post.mine && post.place !== null && (post.kind === 'tip' || post.kind === 'moment');
  const money = (amount: string, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(amount));
  const month = (yyyyMm: string) =>
    new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${yyyyMm}-01T00:00:00Z`),
    );

  return (
    <article className={styles.post} aria-labelledby={`${menuId}-author`} ref={root}>
      <Link href={profileHref} className={styles.postAvatar} tabIndex={-1} aria-hidden="true">
        <PipAvatar size={44} look={post.author.pipLook ?? DEFAULT_PIP_LOOK} still />
      </Link>
      <div className={styles.postMain}>
        <header className={styles.postHead}>
          <span className={styles.postWho}>
            <Link href={profileHref} id={`${menuId}-author`} className={styles.postName}>
              {post.author.name}
            </Link>
            <span className={styles.postHandle}>@{post.author.handle}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={post.createdAt} suppressHydrationWarning>
              {when(post.createdAt)}
            </time>
            {post.editedAt ? <span className={styles.postMeta}>· {t('edited')}</span> : null}
            {post.audience === 'followers' ? (
              <span className={styles.postMeta}>· {t('post.followersOnly')}</span>
            ) : null}
          </span>
          {!post.mine && !isFollowing ? (
            <button type="button" className={styles.followChip} onClick={() => follow(true)}>
              {t('post.follow')}
            </button>
          ) : null}
          <div className={styles.menuWrap}>
            <button
              ref={menuButton}
              type="button"
              className={styles.moreButton}
              aria-expanded={menu !== 'closed'}
              aria-controls={menuId}
              aria-label={t('post.more', { name: post.author.name })}
              onClick={() => setMenu(menu === 'closed' ? 'open' : 'closed')}
            >
              ···
            </button>
            {menu !== 'closed' ? (
              <div id={menuId} className={styles.menu}>
                {menu === 'report' ? (
                  <fieldset className={styles.reportBox}>
                    <legend>{t('post.reportTitle')}</legend>
                    {REPORT_REASONS.map((reason) => (
                      <button key={reason} type="button" onClick={() => sendReport(reason)}>
                        {t(`post.reportReasons.${reason}`)}
                      </button>
                    ))}
                  </fieldset>
                ) : post.mine ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(post.body);
                        setEditing(true);
                        setMenu('closed');
                      }}
                    >
                      {t('post.edit')}
                    </button>
                    <button type="button" onClick={copyLink}>
                      {t('post.copyLink')}
                    </button>
                    <button type="button" className={styles.danger} onClick={remove}>
                      {t('post.delete')}
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => follow(!isFollowing)}>
                      {isFollowing ? t('post.unfollow', { name }) : t('post.followName', { name })}
                    </button>
                    <button type="button" onClick={copyLink}>
                      {t('post.copyLink')}
                    </button>
                    <button type="button" onClick={mute}>
                      {t('post.mute', { name })}
                    </button>
                    <button
                      type="button"
                      className={styles.danger}
                      onClick={() => setMenu('report')}
                    >
                      {t('post.report')}
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </header>

        <p className={styles.kindLine}>
          <span aria-hidden="true">{KIND_GLYPH[post.kind]}</span> {t(`composer.kinds.${post.kind}`)}
          {post.place ? (
            <>
              {' · '}
              <span className={styles.placeChip}>{post.place.name}</span>
            </>
          ) : null}
        </p>

        {editing ? (
          <form className={styles.editForm} onSubmit={saveEdit}>
            <label className={styles.srOnly} htmlFor={`${menuId}-edit`}>
              {t('post.editLabel')}
            </label>
            <textarea
              id={`${menuId}-edit`}
              value={draft}
              maxLength={500}
              rows={3}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className={styles.row}>
              <button type="button" className={styles.ghost} onClick={() => setEditing(false)}>
                {t('post.editCancel')}
              </button>
              <button type="submit" className={styles.primary}>
                {t('post.editSave')}
              </button>
            </div>
          </form>
        ) : post.body ? (
          <p className={styles.postBody}>{post.body}</p>
        ) : null}

        {attachment?.kind === 'route' ? (
          <div className={styles.routeCard}>
            <p className={styles.routeTitle}>
              <span>{t('post.routeLabel')}</span> {attachment.title}
            </p>
            <ol className={styles.stops}>
              {attachment.stops.map((stop, index) => (
                <li key={`${index}-${stop.name}`}>
                  <span className={styles.stopNumber}>{index + 1}</span>
                  {stop.name}
                </li>
              ))}
            </ol>
            <p className={styles.routeMeta}>
              {t('post.routeMeta', { stops: attachment.stops.length, nights: attachment.nights })}
            </p>
            {attachment.total ? (
              <p className={styles.routeMeta}>
                {t('post.estimate', {
                  amount: money(attachment.total.amount, attachment.total.currency),
                })}
              </p>
            ) : null}
            {!post.mine ? (
              <button
                type="button"
                className={styles.copyRoute}
                aria-pressed={copied}
                onClick={() => {
                  if (copied) return;
                  startTransition(async () => {
                    const title = await copyRoute(post.id);
                    if (!title) return failed();
                    setCopied(true);
                    toast(t('toasts.copied', { title }));
                  });
                }}
              >
                {copied ? t('post.copied') : t('post.copyRoute')}
              </button>
            ) : null}
          </div>
        ) : null}

        {attachment?.kind === 'visa' ? (
          <div className={styles.visaCard}>
            <span className={styles.visaStamp} aria-hidden="true">
              <b>{attachment.countryCode}</b>
              <span>{attachment.stampedAt.slice(0, 10)}</span>
            </span>
            <span>
              <strong>
                {t('post.visaLine', { name, country: country(attachment.countryCode) })}
              </strong>
              <span>{t('post.visaSub', { ordinal: attachment.ordinal })}</span>
              <small>{t('post.visaNote')}</small>
            </span>
          </div>
        ) : null}

        {attachment?.kind === 'goal' ? (
          <div className={styles.goalCard}>
            <strong>
              <span aria-hidden="true">★ </span>
              {attachment.reached
                ? t('post.goalReached', { trip: attachment.tripTitle })
                : t('post.goalOnTrack', {
                    trip: attachment.tripTitle,
                    month: month(attachment.readyMonth),
                  })}
            </strong>
            <span>{t('post.goalNote')}</span>
          </div>
        ) : null}

        {savable ? (
          <button
            type="button"
            className={styles.savePlace}
            aria-pressed={placeSaved}
            onClick={() => {
              if (placeSaved || !post.place) return;
              if (!currentTrip) return toast(t('toasts.noTrip'));
              startTransition(async () => {
                if (!(await savePlace(currentTrip.id, post.place!.name))) return failed();
                setPlaceSaved(true);
                toast(t('toasts.placeSaved', { place: post.place!.name }));
              });
            }}
          >
            {placeSaved
              ? `${t('post.placeSaved')} · ${currentTrip?.title ?? ''}`
              : t('post.savePlace')}
          </button>
        ) : null}

        {post.likedBy && !post.mine ? (
          <p className={styles.likedBy}>
            {t('post.likedBy', {
              name: post.liked ? t('you') : firstName(post.likedBy.name),
              others: Math.max(0, post.likes - 1),
            })}
          </p>
        ) : null}

        <div className={styles.actions}>
          <button
            type="button"
            aria-expanded={commentsOpen}
            aria-controls={`${menuId}-comments`}
            onClick={() => setCommentsOpen(!commentsOpen)}
          >
            <span aria-hidden="true">❝</span> {t('post.comments', { count: post.comments })}
          </button>
          <button
            type="button"
            aria-pressed={post.liked}
            className={post.liked ? styles.liked : undefined}
            onClick={() => toggle('like')}
          >
            <span aria-hidden="true" className={styles.heart}>
              {post.liked ? '♥' : '♡'}
            </span>{' '}
            {t('post.likes', { count: post.likes })}
          </button>
          <button
            type="button"
            aria-pressed={post.saved}
            className={post.saved ? styles.savedOn : undefined}
            onClick={() => toggle('save')}
          >
            <span aria-hidden="true">{post.saved ? '■' : '□'}</span>{' '}
            {post.saved ? t('post.saved') : t('post.save')}
          </button>
          <button type="button" onClick={copyLink}>
            <span aria-hidden="true">↗</span> {t('post.share')}
          </button>
        </div>

        {commentsOpen ? (
          <Comments
            id={`${menuId}-comments`}
            postId={post.id}
            onCount={(count) => setPost((current) => ({ ...current, comments: count }))}
          />
        ) : null}
      </div>
    </article>
  );
}

const KIND_GLYPH: Record<PostData['kind'], string> = {
  moment: '◐',
  tip: '✦',
  route: '→',
  visa: '✓',
  goal: '★',
};

/** The inline thread: like, reply (prefills @handle), delete (with Undo) and a new comment. */
function Comments({
  id,
  postId,
  onCount,
}: {
  id: string;
  postId: string;
  onCount: (count: number) => void;
}) {
  const t = useTranslations('communityPage');
  const { toast } = useCommunity();
  const when = useRelativeTime();
  const [comments, setComments] = useState<CommentData[] | null>(null);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void loadComments(postId).then((list) => {
      if (live) setComments(list ?? []);
    });
    return () => {
      live = false;
    };
  }, [postId]);

  const replace = (list: CommentData[]) => {
    setComments(list);
    onCount(list.length);
  };

  function send(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const list = await addComment(postId, body);
      if ('error' in list) return toast(t('toasts.failed'));
      replace(list);
      setDraft('');
    });
  }

  function remove(comment: CommentData) {
    startTransition(async () => {
      if (!(await removeComment(comment.id))) return toast(t('toasts.failed'));
      replace((comments ?? []).filter((c) => c.id !== comment.id));
      toast(t('toasts.commentDeleted'), () => {
        void removeComment(comment.id, true).then(async (ok) => {
          if (ok) replace((await loadComments(postId)) ?? []);
        });
      });
    });
  }

  function like(comment: CommentData) {
    const on = !comment.liked;
    setComments((list) =>
      (list ?? []).map((c) =>
        c.id === comment.id ? { ...c, liked: on, likes: c.likes + (on ? 1 : -1) } : c,
      ),
    );
    void likeComment(comment.id, on);
  }

  return (
    <section id={id} className={styles.thread} aria-label={t('comments.label')}>
      {comments === null ? (
        <p className={styles.muted}>{t('loading')}</p>
      ) : comments.length === 0 ? (
        <p className={styles.muted}>{t('comments.empty')}</p>
      ) : (
        <ul>
          {comments.map((comment) => (
            <li key={comment.id} className={styles.comment}>
              <PipAvatar size={28} look={comment.author.pipLook} still />
              <div>
                <p>
                  <Link href={`/app/community/u/${comment.author.handle}`}>
                    {firstName(comment.author.name)}
                  </Link>{' '}
                  <time dateTime={comment.createdAt} suppressHydrationWarning>
                    {when(comment.createdAt)}
                  </time>
                </p>
                <p className={styles.commentBody}>{comment.body}</p>
                <div className={styles.commentActions}>
                  <button
                    type="button"
                    aria-pressed={comment.liked}
                    className={comment.liked ? styles.liked : undefined}
                    onClick={() => like(comment)}
                  >
                    <span className={styles.srOnly}>{t('comments.like')}</span>
                    <span aria-hidden="true">{comment.liked ? '♥' : '♡'}</span>
                    <span>{comment.likes || ''}</span>
                  </button>
                  {!comment.mine ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(`@${comment.author.handle} `);
                        input.current?.focus();
                      }}
                    >
                      {t('comments.reply')}
                    </button>
                  ) : null}
                  {comment.canDelete ? (
                    <button type="button" onClick={() => remove(comment)}>
                      {t('comments.delete')}
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.commentForm} onSubmit={send}>
        <label className={styles.srOnly} htmlFor={`${id}-input`}>
          {t('comments.placeholder')}
        </label>
        <input
          ref={input}
          id={`${id}-input`}
          value={draft}
          maxLength={500}
          placeholder={t('comments.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button type="submit" className={styles.primary} disabled={pending || !draft.trim()}>
          {t('comments.send')}
        </button>
      </form>
    </section>
  );
}
