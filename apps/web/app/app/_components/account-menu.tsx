'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { SETTINGS_HREF, SETTINGS_ICON as SettingsIcon } from './nav-model';
import { SignOutButton } from './sign-out-button';
import styles from './shell.module.css';

/** The first letter of the name, for the round avatar. Falls back to a dot for an empty name. */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : '\u2022';
}

/**
 * The person's name and the account actions (settings, log out). A disclosure, not an ARIA menu: it is a short
 * list of a link and a button, so Tab moves through it like anywhere else. It closes on Escape (focus returns to
 * the button), on a click outside and when a link in it is followed.
 */
export function AccountMenu({
  name,
  placement,
}: {
  name: string;
  /** Which side of the button the panel opens on: above in the rail's footer, below in the top bar. */
  placement: 'above' | 'below';
}) {
  const t = useTranslations('shell.account');
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
        className={styles.accountButton}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('menu', { name })}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Drawn by CSS (::before) so the button's visible text is only the name, which its label contains. */}
        <span className={styles.avatar} aria-hidden="true" data-initial={initialOf(name)} />
        <span className={styles.accountName} aria-hidden="true">
          {name}
        </span>
      </button>
      <div
        id={panelId}
        className={placement === 'above' ? styles.panelAbove : styles.panelBelow}
        hidden={!open}
        onClick={(event) => {
          // Following the settings link closes the panel; the log-out button leaves the page anyway.
          if ((event.target as HTMLElement).closest('a')) setOpen(false);
        }}
      >
        <Link href={SETTINGS_HREF} className={styles.menuItem}>
          <SettingsIcon aria-hidden="true" strokeWidth={1.6} size={20} />
          <span>{t('settings')}</span>
        </Link>
        <SignOutButton />
      </div>
    </div>
  );
}
