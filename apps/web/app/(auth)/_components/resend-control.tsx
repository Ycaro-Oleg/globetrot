'use client';

import { Button } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { AuthResult } from '../../../lib/auth-client';
import { describeFailure, type AuthForm, type MessageRef } from '../../../lib/auth-errors';
import { RESEND_COOLDOWN_SECONDS, useCountdown } from '../../../lib/countdown';
import { FormBanner, PendingStatus } from './form-parts';

/**
 * "Send the link again" with a visible countdown. The button is disabled while it runs; the server applies its
 * own, authoritative cooldown (a `429` restarts the countdown with the wait it asks for), so the countdown is
 * courtesy, not security.
 */
export function ResendControl({
  onResend,
  form,
  startsCounting = true,
}: {
  onResend: () => Promise<AuthResult>;
  form: AuthForm;
  /** True right after an email was sent, so the first resend waits too. */
  startsCounting?: boolean;
}) {
  const t = useTranslations('auth');
  const { remaining, start } = useCountdown(startsCounting ? RESEND_COOLDOWN_SECONDS : 0);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [banner, setBanner] = useState<MessageRef | null>(null);

  async function resend() {
    setPending(true);
    setBanner(null);
    setSent(false);
    const result = await onResend();
    setPending(false);
    if (result.ok) {
      setSent(true);
      start(RESEND_COOLDOWN_SECONDS);
      return;
    }
    const view = describeFailure(result, form);
    setBanner(view.banner);
    if (view.retryAfter !== undefined) start(view.retryAfter);
  }

  return (
    <div>
      <FormBanner message={banner} />
      <Button variant="ghost" onPress={resend} isDisabled={remaining > 0} isPending={pending}>
        {remaining > 0 ? t('resend.wait', { seconds: remaining }) : t('resend.action')}
      </Button>
      <PendingStatus pending={pending} label={t('resend.pending')} />
      {/* The live region is always in the page, so the text added to it is announced. */}
      <p role="status">{sent ? t('resend.sent') : ''}</p>
    </div>
  );
}
