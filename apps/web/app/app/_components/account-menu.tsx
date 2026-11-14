'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { PipAvatar } from './pip-avatar';
import { SETTINGS_HREF } from './nav-model';
import { SignOutButton } from './sign-out-button';
import styles from './shell.module.css';

/** The first letter of the name. Falls back to a dot for an empty name. */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '•';
}

/**
 * The avatar button (the person's Pip) and the account panel: the name, the account's places, settings and log
 * out. A disclosure, not an ARIA menu: Tab moves through it like anywhere else. It closes on Escape (focus
 * returns to the button), on a click outside and when a link in it is followed.
 */
export function AccountMenu({ name }: { name: string }) {
  const t = useTranslations('shell');
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className={styles.account} ref={root}>
      <button
        ref={button}
        type="button"
        className={styles.avatarButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('account.menu', { name })}
        onClick={() => setOpen((value) => !value)}
      >
        <PipAvatar size={38} still />
      </button>
      <div
        id={panelId}
        className={styles.menu}
        data-align="end"
        hidden={!open}
        onClick={(event) => {
          // Following a link closes the panel; the log-out button leaves the page anyway.
          if ((event.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <p className={styles.menuName}>
          <span className={styles.menuInitial} aria-hidden="true">
            {initialOf(name)}
          </span>
          {name}
        </p>
        <Link href="/app/profile" className={styles.menuItem}>
          {t('nav.profileMenu')}
        </Link>
        <Link href="/app/plan" className={styles.menuItem}>
          {t('nav.plan')}
        </Link>
        <Link href="/app/trips" className={styles.menuItem}>
          {t('nav.trips')}
        </Link>
        <Link href="/app/passport" className={styles.menuItem}>
          {t('nav.passport')}
        </Link>
        <Link href={SETTINGS_HREF} className={styles.menuItem}>
          {t('account.settings')}
        </Link>
        <span className={styles.menuRule} aria-hidden="true" />
        <SignOutButton />
      </div>
    </div>
  );
}
