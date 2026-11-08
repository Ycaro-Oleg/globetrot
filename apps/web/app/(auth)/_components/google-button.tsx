'use client';

import { Button } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { createAuthClient } from '../../../lib/auth-client';
import { describeFailure, type MessageRef } from '../../../lib/auth-errors';
import { FormBanner } from './form-parts';

/**
 * Shown only when the API says Google is configured (`GET /v1/auth/providers`). It asks the server to start the
 * flow and follows the address it returns.
 */
export function GoogleButton({ next }: { next: string }) {
  const t = useTranslations('auth');
  const client = useMemo(() => createAuthClient(), []);
  const [pending, setPending] = useState(false);
  const [banner, setBanner] = useState<MessageRef | null>(null);

  async function start() {
    setPending(true);
    setBanner(null);
    const result = await client.signInWithGoogle(next);
    if (result.ok && typeof result.data.url === 'string') {
      window.location.assign(result.data.url);
      return;
    }
    setPending(false);
    setBanner(result.ok ? { key: 'errors.generic' } : describeFailure(result, 'login').banner);
  }

  return (
    <div>
      <FormBanner message={banner} />
      <Button variant="ghost" size="lg" onPress={start} isPending={pending}>
        {t('google')}
      </Button>
    </div>
  );
}
