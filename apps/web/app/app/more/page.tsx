import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { isPipEnabled } from '../../../lib/flags';
import { SITE_NAME } from '../../site';
import {
  MORE_ITEMS,
  PIP_HREF,
  PIP_ICON as PipIcon,
  SETTINGS_HREF,
  SETTINGS_ICON as SettingsIcon,
} from '../_components/nav-model';
import styles from '../_components/shell.module.css';

export async function generateMetadata() {
  const t = await getTranslations('shell.more');
  return { title: `${t('title')} \u00b7 ${SITE_NAME}` };
}

/** On a phone the tab bar has room for five tools; this page holds the rest of the app. */
export default function MorePage() {
  const t = useTranslations('shell.more');
  const nav = useTranslations('shell.nav');
  const shell = useTranslations('shell');
  return (
    <section>
      <h1 className={styles.pageTitle}>{t('title')}</h1>
      <p className={styles.lead}>{t('description')}</p>
      <ul className={styles.moreList}>
        {MORE_ITEMS.map((entry) => (
          <li key={entry.key}>
            <Link href={entry.href} className={styles.moreLink}>
              <entry.Icon aria-hidden="true" strokeWidth={1.6} size={22} />
              <span>{nav(entry.key)}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={SETTINGS_HREF} className={styles.moreLink}>
            <SettingsIcon aria-hidden="true" strokeWidth={1.6} size={22} />
            <span>{nav('settings')}</span>
          </Link>
        </li>
        {isPipEnabled() ? (
          <li>
            <Link href={PIP_HREF} className={styles.moreLink}>
              <PipIcon aria-hidden="true" strokeWidth={1.6} size={22} />
              <span>{shell('pip.ask')}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
