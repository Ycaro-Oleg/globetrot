'use client';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@globetrot/domain';
import { Banner, Button } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { createAuthClient } from '../../../lib/auth-client';
import { describeFailure, type MessageRef } from '../../../lib/auth-errors';
import { FormBanner, PendingStatus, useAuthMessage, useFocusFirstInvalid } from './form-parts';
import { PasswordField } from './password-field';
import styles from '../auth.module.css';

/**
 * The page the reset email leads to. A missing, used or expired token is shown as such with a way to ask for a
 * new link; a good token gets the new-password form.
 */
export function ResetForm({
  token,
  tokenProblem,
}: {
  token: string | null;
  tokenProblem: boolean;
}) {
  const t = useTranslations('auth');
  const text = useAuthMessage();
  const client = useMemo(() => createAuthClient(), []);
  const form = useRef<HTMLFormElement>(null);

  const [password, setPassword] = useState('');
  const [error, setError] = useState<MessageRef | undefined>();
  const [banner, setBanner] = useState<MessageRef | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(tokenProblem || token === null);
  const [attempt, setAttempt] = useState(0);
  useFocusFirstInvalid(form, attempt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (token === null) return;
    setBanner(null);
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      setError(
        password.length < PASSWORD_MIN_LENGTH
          ? { key: 'errors.passwordTooShort', values: { min: PASSWORD_MIN_LENGTH } }
          : { key: 'errors.passwordTooLong', values: { max: PASSWORD_MAX_LENGTH } },
      );
      setBanner({ key: 'errors.summary' });
      setAttempt((count) => count + 1);
      return;
    }
    setError(undefined);

    setPending(true);
    const result = await client.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.ok) {
      setDone(true);
      return;
    }
    const view = describeFailure(result, 'reset');
    if (view.banner?.key === 'errors.invalidToken') {
      setExpired(true);
      return;
    }
    setError(view.fields.password);
    setBanner(view.banner);
    if (view.fields.password) setAttempt((count) => count + 1);
  }

  // The form stays mounted (hidden) when the screen changes; see the note in the sign-up form.
  const formAvailable = token !== null && !tokenProblem;
  const showForm = !done && !expired;
  return (
    <>
      {done && (
        <>
          <h1 className={styles.title}>{t('reset.title')}</h1>
          <Banner tone="success" role="status">
            {t('reset.done')}
          </Banner>
          <p className={styles.links}>
            <Link href="/login">{t('reset.toLogin')}</Link>
          </p>
        </>
      )}
      {!done && expired && (
        <>
          <h1 className={styles.title}>{t('reset.title')}</h1>
          <Banner tone="error" role="alert">
            {t('errors.invalidToken')}
          </Banner>
          <p className={styles.links}>
            <Link href="/recover">{t('reset.requestNew')}</Link>
            <Link href="/login">{t('recover.backToLogin')}</Link>
          </p>
        </>
      )}
      {formAvailable && (
        <div className={styles.view} hidden={!showForm}>
          <h1 className={styles.title}>{t('reset.title')}</h1>
          <form ref={form} onSubmit={submit} noValidate className={styles.form}>
            <FormBanner message={banner} />
            <PasswordField
              value={password}
              onChange={setPassword}
              label={t('newPassword')}
              autoComplete="new-password"
              errorMessage={error && text(error)}
            />
            <Button type="submit" size="lg" isPending={pending}>
              {t('reset.submit')}
            </Button>
            <PendingStatus pending={pending} label={t('reset.pending')} />
          </form>
        </div>
      )}
    </>
  );
}
