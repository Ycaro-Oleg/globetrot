'use client';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@globetrot/domain';
import { Button, Checkbox, TextField } from '@globetrot/ui';
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
import { PasswordField } from './password-field';
import { ResendControl } from './resend-control';
import styles from '../auth.module.css';

type FieldErrors = {
  name?: MessageRef;
  email?: MessageRef;
  password?: MessageRef;
  terms?: MessageRef;
};

export function SignupForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const text = useAuthMessage();
  const client = useMemo(() => createAuthClient(), []);
  const form = useRef<HTMLFormElement>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<MessageRef | null>(null);
  const [offerLogin, setOfferLogin] = useState(false);
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useFocusFirstInvalid(form, attempt);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: FieldErrors = {};
    if (name.trim() === '') found.name = { key: 'errors.requiredName' };
    if (!EMAIL_PATTERN.test(email.trim())) {
      found.email = { key: email.trim() === '' ? 'errors.requiredEmail' : 'errors.invalidEmail' };
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      found.password = { key: 'errors.passwordTooShort', values: { min: PASSWORD_MIN_LENGTH } };
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      found.password = { key: 'errors.passwordTooLong', values: { max: PASSWORD_MAX_LENGTH } };
    }
    if (!terms) found.terms = { key: 'errors.requiredTerms' };
    setErrors(found);
    setBanner(null);
    setOfferLogin(false);
    if (Object.keys(found).length > 0) {
      setBanner({ key: 'errors.summary' });
      setAttempt((count) => count + 1);
      return;
    }

    setPending(true);
    const result = await client.signUp({ name: name.trim(), email: email.trim(), password });
    setPending(false);
    if (!result.ok) {
      const view = describeFailure(result, 'signup');
      setErrors(view.fields);
      setBanner(view.banner);
      setOfferLogin(view.offerLogin);
      if (Object.keys(view.fields).length > 0) setAttempt((count) => count + 1);
      return;
    }
    // No session yet while the address is unverified: ask them to open the link. If the server does not require
    // verification it opened a session, so go straight in.
    if (result.data.token) {
      router.replace(next);
      router.refresh();
      return;
    }
    setSentTo(email.trim());
  }

  // The form stays mounted (hidden) after success. React Aria's pending button announces itself in a live
  // region that points back at the button, so unmounting it right away leaves a dangling reference.
  return (
    <>
      {sentTo !== null && (
        <>
          <h1 className={styles.title}>{t('signup.sentTitle')}</h1>
          <p className={styles.lead} role="status">
            {t('signup.sentBody', { email: sentTo })}
          </p>
          <ResendControl
            form="resend"
            onResend={() => client.resendVerification({ email: sentTo })}
          />
          <p className={styles.links}>
            <Link href="/login">{t('signup.toLogin')}</Link>
          </p>
        </>
      )}
      <div className={styles.view} hidden={sentTo !== null}>
        <h1 className={styles.title}>{t('signup.title')}</h1>

        {googleEnabled && (
          <>
            <GoogleButton next={next} />
            <p className={styles.divider}>{t('or')}</p>
          </>
        )}

        <form ref={form} onSubmit={submit} noValidate className={styles.form}>
          <FormBanner message={banner} />

          <TextField
            name="name"
            label={t('firstName')}
            value={name}
            onChange={setName}
            autoComplete="given-name"
            validationBehavior="aria"
            isInvalid={errors.name !== undefined}
            errorMessage={errors.name && text(errors.name)}
          />
          <TextField
            type="email"
            name="email"
            label={t('email')}
            value={email}
            onChange={setEmail}
            autoComplete="email"
            validationBehavior="aria"
            isInvalid={errors.email !== undefined}
            errorMessage={
              errors.email && (
                <>
                  {text(errors.email)}
                  {offerLogin && (
                    <>
                      {' '}
                      <Link href="/login">{t('signup.toLogin')}</Link>
                    </>
                  )}
                </>
              )
            }
          />
          <PasswordField
            value={password}
            onChange={setPassword}
            label={t('password')}
            autoComplete="new-password"
            errorMessage={errors.password && text(errors.password)}
          />

          <div>
            <Checkbox
              isSelected={terms}
              onChange={setTerms}
              isInvalid={errors.terms !== undefined}
              {...(errors.terms ? { 'aria-describedby': 'terms-error' } : {})}
            >
              {t.rich('signup.terms', {
                terms: (chunks) => (
                  <Link href="/terms" target="_blank" rel="noopener">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/privacy" target="_blank" rel="noopener">
                    {chunks}
                  </Link>
                ),
              })}
            </Checkbox>
            {errors.terms && (
              <p id="terms-error" className={styles.fieldNote}>
                {text(errors.terms)}
              </p>
            )}
          </div>

          <Button type="submit" variant="thread" size="lg" isPending={pending}>
            {t('signup.submit')}
          </Button>
          <PendingStatus pending={pending} label={t('signup.pending')} />
        </form>

        <p className={styles.links}>
          <span>{t('signup.haveAccount')}</span>
          <Link href="/login">{t('signup.toLogin')}</Link>
        </p>
      </div>
    </>
  );
}
