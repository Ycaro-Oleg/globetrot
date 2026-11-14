'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { updateTripFields } from '../../_components/trip-actions';
import styles from './trip-hub.module.css';

/** The trip's name as the page title, with an inline "Rename". */
export function TitleEditor({ tripId, title }: { tripId: string; title: string }) {
  const t = useTranslations('tripHub');
  const router = useRouter();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return setError(true);
    startTransition(async () => {
      const ok = await updateTripFields(tripId, { title: value });
      setError(!ok);
      if (ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <div className={styles.titleRow}>
        <h1 className={styles.title} id="trip-title">
          {title}
        </h1>
        <button type="button" className={styles.ghost} onClick={() => setEditing(true)}>
          {t('rename')}
        </button>
      </div>
    );
  }
  return (
    <form className={styles.titleForm} onSubmit={submit}>
      <label htmlFor={`${id}-title`} className={styles.srOnly}>
        {t('nameLabel')}
      </label>
      <input
        id={`${id}-title`}
        value={value}
        maxLength={120}
        autoFocus
        aria-invalid={error || undefined}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className={styles.primary} disabled={pending}>
        {t('saveName')}
      </button>
      <button
        type="button"
        className={styles.ghost}
        onClick={() => {
          setValue(title);
          setEditing(false);
        }}
      >
        {t('cancel')}
      </button>
      {error ? (
        <p role="alert" className={styles.error}>
          {t('nameError')}
        </p>
      ) : null}
    </form>
  );
}
