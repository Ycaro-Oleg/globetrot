'use client';

import { Button } from '@globetrot/ui';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { createAuthClient } from '../../lib/auth-client';

export function SignOutButton() {
  const t = useTranslations('app');
  const router = useRouter();
  const client = useMemo(() => createAuthClient(), []);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await client.signOut();
    // Even if the request failed the person asked to leave: go to the log-in page, which shows the truth.
    router.replace('/login');
    router.refresh();
  }

  return (
    <Button variant="ghost" onPress={signOut} isPending={pending}>
      {t('signOut')}
    </Button>
  );
}
