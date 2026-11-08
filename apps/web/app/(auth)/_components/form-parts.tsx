'use client';

import { Banner } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { useEffect, type RefObject } from 'react';
import type { MessageRef } from '../../../lib/auth-errors';

/** Turns a `MessageRef` from the error mapper into text in the current language. */
export function useAuthMessage() {
  const t = useTranslations('auth');
  return (message: MessageRef) => t(message.key, message.values);
}

/**
 * A message above the form. `role="alert"` makes assistive technology read it as soon as it appears, so a
 * failed submit is never silent.
 */
export function FormBanner({ message }: { message: MessageRef | null }) {
  const text = useAuthMessage();
  if (!message) return null;
  return (
    <Banner tone="error" role="alert">
      {text(message)}
    </Banner>
  );
}

/** What the screen reader hears while a request is running, without adding anything to the page. */
export function PendingStatus({ pending, label }: { pending: boolean; label: string }) {
  return (
    <p role="status" className="sr-only">
      {pending ? label : ''}
    </p>
  );
}

/**
 * Moves focus to the first field the last submit rejected, so a keyboard or screen-reader user lands on the
 * problem instead of hunting for it. Runs when `trigger` changes (once per failed submit).
 */
export function useFocusFirstInvalid(form: RefObject<HTMLFormElement | null>, trigger: unknown) {
  useEffect(() => {
    if (trigger === null || trigger === undefined || trigger === 0) return;
    const invalid = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    invalid?.focus();
  }, [form, trigger]);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
