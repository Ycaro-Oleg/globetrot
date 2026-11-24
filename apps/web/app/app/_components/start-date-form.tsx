'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { updateTripFields } from './trip-actions';
import styles from './start-date-form.module.css';

/**
 * The trip's start date, set where it matters (Days, the trip page): days get real dates and the savings answer
 * can say whether you will be ready in time. Clearing it is allowed.
 */
export function StartDateForm({
  tripId,
  startDate,
  compact = false,
}: {
  tripId: string;
  startDate: string | null;
  compact?: boolean;
}) {
  const t = useTranslations('tripHub.date');
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState(startDate ?? '');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  const changed = value !== (startDate ?? '');

  function submit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const ok = await updateTripFields(tripId, { startDate: value || null });
      setStatus(ok ? 'saved' : 'error');
      if (ok) router.refresh();
    });
  }

  return (
    <form className={styles.form} data-compact={compact || undefined} onSubmit={submit}>
      <label htmlFor={`${id}-date`}>{t('label')}</label>
      <div className={styles.row}>
        <input
          id={`${id}-date`}
          type="date"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setStatus('idle');
          }}
        />
        <button type="submit" className={styles.save} disabled={pending || !changed}>
          {pending ? t('saving') : t('save')}
        </button>
      </div>
      <p className={styles.status} role="status">
        {status === 'saved' ? t('saved') : status === 'error' ? t('error') : ''}
      </p>
    </form>
  );
}
