'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { deleteAccount, type DeleteAccountResult } from './data-actions';
import styles from './settings.module.css';

/**
 * "Your data": download everything (LGPD/GDPR access and portability) and delete the account for good, after
 * typing the email again. Deleting signs the person out and leads to the log-in page. A paid plan is canceled
 * with it (#201); when that cancellation fails, nothing is deleted and the message says so.
 */
export function YourData({ email }: { email: string }) {
  const t = useTranslations('settings.data');
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<Exclude<DeleteAccountResult, 'ok'> | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount(typed);
      if (result !== 'ok') return setError(result);
      router.replace('/login?deleted=1');
      router.refresh();
    });
  }

  return (
    <section className={styles.sheet} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={styles.sectionTitle}>
        {t('title')}
      </h2>
      <div className={styles.dataRow}>
        <div>
          <h3>{t('exportTitle')}</h3>
          <p className={styles.description}>{t('exportBody')}</p>
        </div>
        <a href="/v1/me/export" download className={styles.secondaryButton}>
          {t('exportAction')}
        </a>
      </div>
      <div className={styles.dataRow}>
        <div>
          <h3>{t('deleteTitle')}</h3>
          <p className={styles.description}>{t('deleteBody')}</p>
        </div>
        {!open ? (
          <button type="button" className={styles.dangerButton} onClick={() => setOpen(true)}>
            {t('deleteStart')}
          </button>
        ) : null}
      </div>
      {open ? (
        <form className={styles.deleteForm} onSubmit={submit} noValidate>
          <ul>
            <li>{t('deleteList1')}</li>
            <li>{t('deleteList2')}</li>
            <li>{t('deleteList3')}</li>
            <li>{t('deletePlan')}</li>
          </ul>
          <label htmlFor={`${id}-email`}>{t('confirmLabel', { email })}</label>
          <input
            id={`${id}-email`}
            type="email"
            autoComplete="off"
            value={typed}
            aria-invalid={error === 'mismatch' || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(event) => setTyped(event.target.value)}
          />
          {error ? (
            <p id={`${id}-error`} role="alert" className={styles.error}>
              {t(error === 'unavailable' ? 'planNotCanceled' : 'mismatch')}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setOpen(false)}>
              {t('cancel')}
            </button>
            <button
              type="submit"
              className={styles.dangerButton}
              disabled={pending || typed.trim().toLowerCase() !== email.trim().toLowerCase()}
            >
              {pending ? t('deleting') : t('deleteConfirm')}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
