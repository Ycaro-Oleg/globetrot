'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BOTTOM_ITEMS, GLOBAL_LINKS, isCurrent, isTripPage, TRIP_TABS } from './nav-model';
import styles from './shell.module.css';

/**
 * The current trip's tools as a segmented control: inline in the bar on a wide screen (`inline`), a second
 * sticky row of four equal pills on a phone (`row`, only on trip pages).
 */
export function TripTabs({ variant }: { variant: 'inline' | 'row' }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  if (variant === 'row' && !isTripPage(pathname)) return null;
  return (
    <nav
      aria-label={t('tripLabel')}
      className={variant === 'inline' ? styles.tabsInline : styles.tabsRow}
    >
      {TRIP_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={styles.tab}
          aria-current={isCurrent(tab, pathname) ? 'page' : undefined}
        >
          {t(tab.key)}
        </Link>
      ))}
    </nav>
  );
}

/** The account's places on the right of the bar, with a blue underline on the current one. */
export function GlobalNav({ pipEnabled }: { pipEnabled: boolean }) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  return (
    <nav aria-label={t('nav.globalLabel')} className={styles.globalNav}>
      {GLOBAL_LINKS.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className={styles.globalLink}
          aria-current={isCurrent(link, pathname) ? 'page' : undefined}
        >
          {t(`nav.${link.key}`)}
        </Link>
      ))}
      {pipEnabled ? (
        <Link
          href="/app/pip"
          className={styles.globalLink}
          aria-current={pathname === '/app/pip' ? 'page' : undefined}
        >
          {t('pip.ask')}
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * The phone's bottom bar. It steps aside on the map, where the route sheet takes the bottom of the screen.
 * `data-shell-tabbar` lets the board measure what is left of the viewport.
 */
export function BottomBar({ pipEnabled }: { pipEnabled: boolean }) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  if (pathname === '/app/board' || pathname.startsWith('/app/board/')) return null;
  return (
    <nav aria-label={t('nav.globalLabel')} className={styles.bottomBar} data-shell-tabbar="">
      {BOTTOM_ITEMS.map((entry) => (
        <Link
          key={entry.key}
          href={entry.href}
          className={styles.bottomLink}
          aria-current={isCurrent(entry, pathname) ? 'page' : undefined}
        >
          <span aria-hidden="true" className={styles.bottomMark} />
          {t(`nav.${entry.key}`)}
        </Link>
      ))}
      {pipEnabled ? (
        <Link
          href="/app/pip"
          className={styles.bottomLink}
          aria-current={pathname === '/app/pip' ? 'page' : undefined}
        >
          <span aria-hidden="true" className={styles.bottomMark} />
          {t('pip.ask')}
        </Link>
      ) : null}
    </nav>
  );
}
