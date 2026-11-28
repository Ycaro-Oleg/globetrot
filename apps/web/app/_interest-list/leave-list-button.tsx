'use client';

import { Button } from '@globetrot/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { leaveInterestList } from '../../lib/leads';

/**
 * Leaving the list happens on this button only, never when the page loads, so a link scanner opening the email's
 * link unsubscribes nobody.
 */
export function LeaveListButton({ token }: { token: string }) {
  const t = useTranslations('interestList.leave');
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state === 'done') heading.current?.focus();
  }, [state]);

  if (state === 'done') {
    return (
      <>
        <h1 ref={heading} tabIndex={-1}>
          {t('doneTitle')}
        </h1>
        <p role="status">{t('doneBody')}</p>
        <p>
          <Link href="/">{t('back')}</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('body')}</p>
      <p role="alert">{state === 'error' ? t('error') : ''}</p>
      <Button
        variant="primary"
        isPending={state === 'pending'}
        onPress={async () => {
          if (state === 'pending') return;
          setState('pending');
          setState((await leaveInterestList(token)) ? 'done' : 'error');
        }}
      >
        {t('submit')}
      </Button>
      <p role="status" className="sr-only">
        {state === 'pending' ? t('pending') : ''}
      </p>
      <p>
        <Link href="/">{t('back')}</Link>
      </p>
    </>
  );
}
