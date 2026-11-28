'use client';

import { Button, Checkbox, TextField } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { joinInterestList, type LeadSource, type ListLocale } from '../../lib/leads';
import { EMAIL_PATTERN } from '../(auth)/_components/form-parts';
import styles from './interest-list.module.css';

type ErrorKey = 'requiredEmail' | 'invalidEmail' | 'consentRequired' | 'rateLimited' | 'server';

/**
 * The interest list form (#192): an email with a visible label, an unticked consent box, the Privacy link and
 * what the emails are. Every state is text, announced to screen readers, never colour alone. It sits beside the
 * main call to action and never replaces it.
 */
export function InterestListForm({ source, locale }: { source: LeadSource; locale: ListLocale }) {
  const t = useTranslations('interestList');
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: ErrorKey; consent?: ErrorKey; form?: ErrorKey }>(
    {},
  );
  const [attempt, setAttempt] = useState(0);
  const successRef = useRef<HTMLHeadingElement>(null);

  // A rejected submit moves the focus to the first field to fix.
  useEffect(() => {
    if (attempt === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);
  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const address = email.trim();
    const found: typeof errors = {};
    if (address === '') found.email = 'requiredEmail';
    else if (!EMAIL_PATTERN.test(address) || address.length > 254) found.email = 'invalidEmail';
    if (!consent) found.consent = 'consentRequired';
    setErrors(found);
    if (found.email || found.consent) {
      setAttempt((count) => count + 1);
      return;
    }
    setPending(true);
    const outcome = await joinInterestList({ email: address, locale, consent: true, source });
    setPending(false);
    if (outcome.kind === 'accepted') {
      setSent(true);
      return;
    }
    if (outcome.kind === 'invalid') {
      setErrors(
        outcome.field === 'consent'
          ? { consent: 'consentRequired' }
          : outcome.field === 'email'
            ? { email: 'invalidEmail' }
            : { form: 'server' },
      );
      setAttempt((count) => count + 1);
      return;
    }
    setErrors({ form: outcome.kind === 'rate-limited' ? 'rateLimited' : 'server' });
  }

  const summary = errors.form ?? errors.email ?? errors.consent;
  const consentError = `${id}-consent-error`;
  return (
    <section className={styles.list} aria-labelledby={`${id}-title`} data-interest-list="">
      <h2 id={`${id}-title`} className={styles.title}>
        {t('title')}
      </h2>
      <p className={styles.promise}>{t('promise')}</p>
      {sent ? (
        <div className={styles.success}>
          <h3 ref={successRef} tabIndex={-1}>
            {t('successTitle')}
          </h3>
          <p role="status">{t('successBody')}</p>
        </div>
      ) : null}
      {/* Kept mounted after success (hidden), as the sign-up form does: React Aria's pending button points at it. */}
      <form ref={form} onSubmit={submit} noValidate className={styles.form} hidden={sent}>
        <p role="alert" className={summary ? styles.alert : 'sr-only'}>
          {summary ? t(`errors.${summary}`) : ''}
        </p>
        <TextField
          type="email"
          name="email"
          label={t('email')}
          value={email}
          onChange={setEmail}
          autoComplete="email"
          validationBehavior="aria"
          isInvalid={errors.email !== undefined}
          errorMessage={errors.email && t(`errors.${errors.email}`)}
        />
        <Checkbox
          name="consent"
          isSelected={consent}
          onChange={setConsent}
          validationBehavior="aria"
          isInvalid={errors.consent !== undefined}
          {...(errors.consent ? { 'aria-describedby': consentError } : {})}
        >
          {t('consent')}
        </Checkbox>
        {errors.consent ? (
          <p id={consentError} className={styles.fieldError}>
            {t(`errors.${errors.consent}`)}
          </p>
        ) : null}
        <p className={styles.privacy}>
          {t.rich('privacy', {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" rel="noopener">
                {chunks}
              </Link>
            ),
          })}
        </p>
        {/* A quieter button than "Try free": signing up stays the main call to action. */}
        <Button type="submit" variant="ghost" isPending={pending}>
          {t('submit')}
        </Button>
        <p role="status" className="sr-only">
          {pending ? t('pending') : ''}
        </p>
      </form>
    </section>
  );
}
