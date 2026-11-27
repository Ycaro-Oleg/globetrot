'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition } from 'react';
import { track } from '../../../../lib/analytics';
import {
  createInviteLink,
  leaveTrip,
  removeTripMember,
  revokeInviteLink,
} from '../../_components/member-actions';
import { tripCode } from '../../_components/nav-model';
import styles from './trip-hub.module.css';

export interface MembersView {
  readonly members: readonly {
    userId: string;
    name: string;
    role: 'owner' | 'editor' | 'viewer';
    you: boolean;
  }[];
  readonly invites: readonly { id: string; role: 'editor' | 'viewer'; expiresAt: string }[];
  readonly guestLimit: number | null;
}

/**
 * Who plans the trip (ADR-0024). The owner makes an invite link to copy and send (Globetrot sends nothing),
 * stops open links and takes people off; a member can leave. Roles: an editor changes the plan, a viewer reads.
 */
export function MembersCard({
  tripId,
  isOwner,
  initial,
}: {
  tripId: string;
  isOwner: boolean;
  initial: MembersView;
}) {
  const t = useTranslations('tripMembers');
  const id = useId();
  const router = useRouter();
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [link, setLink] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [origin, setOrigin] = useState('');
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    // Only the browser knows the address it is on.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const invite = () =>
    startTransition(async () => {
      setStatus('');
      const result = await createInviteLink(tripId, role);
      if ('token' in result) {
        setLink(`${origin}/app/invite/${result.token}`);
        setStatus(t('linkReady'));
        track('member_invited');
        router.refresh();
      } else {
        setStatus(result.error === 'limit' ? t('limit') : t('failed'));
      }
    });
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setStatus(t('copied'));
    } catch {
      setStatus(t('copyFailed'));
    }
  };
  const run = (action: () => Promise<boolean>, done: string) =>
    startTransition(async () => {
      setStatus((await action()) ? done : t('failed'));
      router.refresh();
    });

  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{t('title')}</h2>
      <ul className={styles.people}>
        {initial.members.map((member) => (
          <li key={member.userId}>
            <span className={styles.personDisc} aria-hidden="true">
              {tripCode(member.name || '?')}
            </span>
            <span className={styles.personText}>
              <strong>{member.you ? t('you', { name: member.name }) : member.name}</strong>
              <span>{t(`role.${member.role}`)}</span>
            </span>
            {isOwner && member.role !== 'owner' ? (
              <button
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() =>
                  run(
                    () => removeTripMember(tripId, member.userId),
                    t('removed', { name: member.name }),
                  )
                }
              >
                {t('remove')}
                <span className="sr-only"> {member.name}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <>
          <p className={styles.hint}>
            {initial.guestLimit === null
              ? t('hint')
              : t('hintLimit', { count: initial.guestLimit })}
          </p>
          <fieldset className={styles.roleChoice}>
            <legend>{t('roleLabel')}</legend>
            {(['editor', 'viewer'] as const).map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={`${id}-role`}
                  value={value}
                  checked={role === value}
                  onChange={() => setRole(value)}
                />
                {t(`roleChoice.${value}`)}
              </label>
            ))}
          </fieldset>
          <button type="button" className={styles.primary} disabled={pending} onClick={invite}>
            {t('invite')}
          </button>
          {link ? (
            <div className={styles.shareRow}>
              <input
                className={styles.shareUrl}
                readOnly
                value={link}
                aria-label={t('linkLabel')}
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" className={styles.ghost} onClick={copy}>
                {t('copy')}
              </button>
            </div>
          ) : null}
          {initial.invites.length ? (
            <ul className={styles.invites} aria-label={t('openLinks')}>
              {initial.invites.map((open) => (
                <li key={open.id}>
                  <span>{t('openLink', { role: t(`role.${open.role}`) })}</span>
                  <button
                    type="button"
                    className={styles.ghost}
                    disabled={pending}
                    onClick={() => run(() => revokeInviteLink(tripId, open.id), t('revoked'))}
                  >
                    {t('revoke')}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <form action={leaveTrip}>
          <input type="hidden" name="tripId" value={tripId} />
          <button type="submit" className={styles.ghost}>
            {t('leave')}
          </button>
        </form>
      )}
      <p className={styles.hint} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
