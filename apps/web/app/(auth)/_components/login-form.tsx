'use client';

import { Button, TextField } from '@globetrot/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { GoogleButton } from './google-button';
import { ResendControl } from './resend-control';
import styles from '../auth.module.css';

export function LoginForm({
  next,
  googleEnabled,
  providerFailed = false,
}: {
  next: string;
  googleEnabled: boolean;
  /** The visitor came back from a provider that did not sign them in (`/login?error=...`). */
  providerFailed?: boolean;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const text = useAuthMessage();
  const client = useMemo(() => createAuthClient(), []);
  const form = useRef<HTMLFormElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: MessageRef; password?: MessageRef }>({});
  const [banner, setBanner] = useState<MessageRef | null>(
    providerFailed ? { key: 'errors.socialFailed' } : null,
  );
  const [offerResend, setOfferResend] = useState(false);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusFirstInvalid(form, attempt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof errors = {};
    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = { key: email.trim() === '' ? 'errors.requiredEmail' : 'errors.invalidEmail' };
    }
    if (password === '') found.password = { key: 'errors.requiredPassword' };
    setErrors(found);
    setBanner(null);
    setOfferResend(false);
    if (Object.keys(found).length > 0) {
      setBanner({ key: 'errors.summary' });
      setAttempt((count) => count + 1);
      return;
    }

    setPending(true);
    const result = await client.signIn({ email: email.trim(), password });
    if (result.ok) {
      router.replace(next);
      router.refresh();
      return;
    }
    setPending(false);
    const view = describeFailure(result, 'login');
    setBanner(view.banner);
    setOfferResend(view.offerResend);
  }

  return (
    <section className={styles.view} aria-labelledby="login-title">
      <h1 id="login-title" className={styles.title}>
        {t('login.title')}
      </h1>

      {googleEnabled && (
        <>
          <GoogleButton next={next} />
          <p className={styles.divider}>{t('or')}</p>
        </>
      )}

      <form ref={form} onSubmit={submit} noValidate className={styles.form}>
        <FormBanner message={banner} />
        {offerResend && (
          <ResendControl
            form="login"
            startsCounting={false}
            onResend={() => client.resendVerification({ email: email.trim() })}
          />
        )}

        <TextField
          type="email"
          name="email"
          label={t('email')}
          placeholder="you@email.com"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          validationBehavior="aria"
          isInvalid={errors.email !== undefined}
          errorMessage={errors.email && text(errors.email)}
        />
        <TextField
          type="password"
          name="password"
          label={t('password')}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          validationBehavior="aria"
          isInvalid={errors.password !== undefined}
          errorMessage={errors.password && text(errors.password)}
        />
        <p className={styles.forgotRow}>
          <Link className={styles.passwordForgot} href="/recover">
            {t('login.forgot')}
          </Link>
        </p>
        <Button type="submit" size="lg" isPending={pending}>
          {t('login.submit')}
        </Button>
        <PendingStatus pending={pending} label={t('login.pending')} />
      </form>

      <p className={styles.links}>
        <span>{t('login.noAccount')}</span>
        <Link href="/signup">{t('login.toSignup')}</Link>
      </p>
    </section>
  );
}
