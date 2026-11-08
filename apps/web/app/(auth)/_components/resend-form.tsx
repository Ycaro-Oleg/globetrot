'use client';

import { Button, TextField } from '@globetrot/ui';
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

/** For a verification link that did not work: ask for a new one by email address. */
export function ResendForm() {
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
    const result = await client.resendVerification({ email: email.trim() });
    setPending(false);
    if (!result.ok) {
      setBanner(describeFailure(result, 'resend').banner);
      return;
    }
    setSentTo(email.trim());
  }

  // The form stays mounted (hidden) after success; see the note in the sign-up form.
  return (
    <>
      {sentTo !== null && (
        <>
          <p className={styles.lead} role="status">
            {t('signup.sentBody', { email: sentTo })}
          </p>
          <ResendControl
            form="resend"
            onResend={() => client.resendVerification({ email: sentTo })}
          />
        </>
      )}
      <div className={styles.view} hidden={sentTo !== null}>
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
            {t('verified.sendNew')}
          </Button>
          <PendingStatus pending={pending} label={t('resend.pending')} />
        </form>
      </div>
    </>
  );
}
