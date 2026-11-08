'use client';

import { Button, TextField } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { createAuthClient } from '../../../lib/auth-client';
import { describeFailure, type MessageRef } from '../../../lib/auth-errors';
import {
  EMAIL_PATTERN,
  FormBanner,
  PendingStatus,
  useAuthMessage,
  useFocusFirstInvalid,
} from './form-parts';
import { ResendControl } from './resend-control';
import styles from '../auth.module.css';

export function RecoverForm() {
  const t = useTranslations('auth');
  const text = useAuthMessage();
  const client = useMemo(() => createAuthClient(), []);
  const form = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [error, setError] = useState<MessageRef | undefined>();
  const [banner, setBanner] = useState<MessageRef | null>(null);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusFirstInvalid(form, attempt);

  const request = (address: string) =>
    client.requestReset({ email: address }, window.location.origin);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBanner(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError({ key: email.trim() === '' ? 'errors.requiredEmail' : 'errors.invalidEmail' });
      setBanner({ key: 'errors.summary' });
      setAttempt((count) => count + 1);
      return;
    }
    setError(undefined);

    setPending(true);
    const result = await request(email.trim());
    setPending(false);
    if (!result.ok) {
      setBanner(describeFailure(result, 'recover').banner);
      return;
    }
    // The server answers the same for an address with an account and one without, and so does this screen.
    setSentTo(email.trim());
  }

  // The form stays mounted (hidden) after success. React Aria's pending button announces itself in a live
  // region that points back at the button, so unmounting it right away leaves a dangling reference.
  return (
    <>
      {sentTo !== null && (
        <>
          <h1 className={styles.title}>{t('recover.sentTitle')}</h1>
          <p className={styles.lead} role="status">
            {t('recover.sentBody', { email: sentTo })}
          </p>
          <ResendControl form="resend" onResend={() => request(sentTo)} />
          <p className={styles.links}>
            <Link href="/login">{t('recover.backToLogin')}</Link>
          </p>
        </>
      )}
      <div className={styles.view} hidden={sentTo !== null}>
        <h1 className={styles.title}>{t('recover.title')}</h1>
        <p className={styles.lead}>{t('recover.intro')}</p>

        <form ref={form} onSubmit={submit} noValidate className={styles.form}>
          <FormBanner message={banner} />
          <TextField
            type="email"
            name="email"
            label={t('email')}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            validationBehavior="aria"
            isInvalid={error !== undefined}
            errorMessage={error && text(error)}
          />
          <Button type="submit" size="lg" isPending={pending}>
            {t('recover.submit')}
          </Button>
          <PendingStatus pending={pending} label={t('recover.pending')} />
        </form>

        <p className={styles.links}>
          <Link href="/login">{t('recover.backToLogin')}</Link>
        </p>
      </div>
    </>
  );
}
