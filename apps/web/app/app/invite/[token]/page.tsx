import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../../lib/api-proxy';
import { createServerApiClient, sessionCookieHeader } from '../../../../lib/stored-preferences';
import { acceptInvite } from '../../_components/member-actions';
import { JoinButton } from './join-button';
import styles from './invite.module.css';

export async function generateMetadata() {
  const t = await getTranslations('invitePage');
  return { title: t('title') };
}

/**
 * Where an invite link lands (ADR-0024). Signing in comes first (the app's gate sends the person to log in or
 * sign up and back here); then it says whose trip it is and what the role allows, and joins in one tap.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const [{ token }, { status }, t, store] = await Promise.all([
    params,
    searchParams,
    getTranslations('invitePage'),
    cookies(),
  ]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const preview =
    cookieHeader && /^[A-Za-z0-9_-]{22}$/.test(token)
      ? await createServerApiClient({ cookieHeader, apiUrl: apiInternalUrl() })
          .GET('/v1/invites/{token}', { params: { path: { token } } })
          .then((response) => response.data ?? null)
          .catch(() => null)
      : null;

  return (
    <section className={styles.page} aria-labelledby="invite-title">
      <div className={styles.card}>
        <h1 id="invite-title">{t('title')}</h1>
        {!preview ? (
          <>
            <p role="status">{t('notFound')}</p>
            <Link className={styles.secondary} href="/app/trips">
              {t('back')}
            </Link>
          </>
        ) : (
          <>
            <p className={styles.lead}>
              {t('body', { owner: preview.ownerName, trip: preview.tripTitle })}
            </p>
            <p>{t(preview.role === 'editor' ? 'roleEditor' : 'roleViewer')}</p>
            {status === 'limit' || status === 'error' ? (
              <p role="alert" className={styles.alert}>
                {t(status)}
              </p>
            ) : null}
            {preview.joined ? (
              <>
                <p role="status">{t('joined')}</p>
                <Link className={styles.primary} href={`/app/trips/${preview.tripId}`}>
                  {t('open')}
                </Link>
              </>
            ) : (
              <form action={acceptInvite}>
                <input type="hidden" name="token" value={token} />
                <JoinButton label={t('accept')} />
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
