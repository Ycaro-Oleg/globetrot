'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PipAvatar } from './pip-avatar';
import type { PipTopic } from './ask-pip-link';
import styles from './shell.module.css';

const TOPICS: readonly [string, PipTopic][] = [
  ['/app/trip', 'days'],
  ['/app/days', 'days'],
  ['/app/budget', 'budget'],
  ['/app/lists', 'lists'],
];

/**
 * Pip, one tap away on every screen: a floating button that opens Pip with an idea for the screen it was pressed
 * on. It steps aside on Pip's own page and on the map, where the route panel already asks Pip about the route.
 */
export function PipFab() {
  const t = useTranslations('shell.pip');
  const pathname = usePathname();
  if (pathname.startsWith('/app/pip') || pathname.startsWith('/app/board')) return null;
  const topic = TOPICS.find(([base]) => pathname === base || pathname.startsWith(`${base}/`))?.[1];
  return (
    <Link href={topic ? `/app/pip?topic=${topic}` : '/app/pip'} className={styles.pipFab}>
      <PipAvatar size={34} still />
      <span>{t('ask')}</span>
    </Link>
  );
}
