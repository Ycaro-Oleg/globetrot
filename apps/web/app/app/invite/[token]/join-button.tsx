'use client';

import { useFormStatus } from 'react-dom';
import { track } from '../../../../lib/analytics';
import styles from './invite.module.css';

/** The join button: counts the join for product analytics and stays disabled while it is sent. */
export function JoinButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={styles.primary}
      disabled={pending}
      onClick={() => track('member_joined')}
    >
      {label}
    </button>
  );
}
