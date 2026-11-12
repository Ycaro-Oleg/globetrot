'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isCurrent, RAIL_ITEMS, TAB_ITEMS, type NavItem } from './nav-model';
import styles from './shell.module.css';

function Links({ items, variant }: { items: readonly NavItem[]; variant: 'rail' | 'tab' }) {
  const t = useTranslations('shell.nav');
  const pathname = usePathname();
  return (
    <ul className={variant === 'rail' ? styles.navList : styles.tabList}>
      {items.map((entry) => {
        const current = isCurrent(entry, pathname);
        return (
          <li key={entry.key} className={variant === 'rail' ? styles.navItem : styles.tabItem}>
            <Link
              href={entry.href}
              aria-current={current ? 'page' : undefined}
              className={variant === 'rail' ? styles.navLink : styles.tabLink}
            >
              <entry.Icon aria-hidden="true" strokeWidth={1.6} size={22} className={styles.icon} />
              <span className={variant === 'rail' ? styles.navLabel : styles.tabLabel}>
                {t(entry.key)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The side rail's links: full width on desktop, icons only on tablet. */
export function RailNav() {
  const t = useTranslations('shell.nav');
  return (
    <nav aria-label={t('label')} className={styles.railNav}>
      <Links items={RAIL_ITEMS} variant="rail" />
    </nav>
  );
}

/** The five-tab bar that floats at the bottom of a phone screen. */
export function TabBar() {
  const t = useTranslations('shell.nav');
  return (
    <nav aria-label={t('label')} className={styles.tabBar} data-shell-tabbar="">
      <Links items={TAB_ITEMS} variant="tab" />
    </nav>
  );
}
