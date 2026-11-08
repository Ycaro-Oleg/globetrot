'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { LogOut } from 'lucide-react';
import { createAuthClient } from '../../../lib/auth-client';
import styles from './shell.module.css';

export function SignOutButton() {
  const t = useTranslations('shell.account');
  const router = useRouter();
  const client = useMemo(() => createAuthClient(), []);
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    await client.signOut();
    // Even if the request failed the person asked to leave: go to the log-in page, which shows the truth.
    router.replace('/login');
    router.refresh();
  }

  return (
    <button type="button" className={styles.menuItem} onClick={signOut} aria-disabled={pending}>
      <LogOut aria-hidden="true" strokeWidth={1.6} size={20} />
      <span>{pending ? t('signingOut') : t('signOut')}</span>
    </button>
  );
}
