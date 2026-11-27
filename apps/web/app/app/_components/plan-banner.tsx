'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { BillingView } from '../../../lib/billing';
import styles from './shell.module.css';

/**
 * The free week under the TopBar: the days left while it runs, and, once it is over without a plan, that the
 * account holds more trips than the free plan keeps and nothing is lost. Nothing for a paid plan, and nothing on the plan page itself,
 * which says the same thing in full. While the week runs, wide screens show it as a small pill in the bar
 * (`variant="pill"`) instead of a whole line; the line stays for narrow screens and for the ended week.
 */
export function PlanBanner({
  billing,
  variant = 'row',
}: {
  billing: BillingView | null;
  variant?: 'row' | 'pill';
}) {
  const t = useTranslations('shell.plan');
  const pathname = usePathname();
  if (!billing || pathname === '/app/plan') return null;
  if (variant === 'pill') {
    if (billing.overLimit || billing.access !== 'trial') return null;
    return (
      <Link
        href="/app/plan"
        className={styles.planPill}
        data-tone={billing.trialDaysLeft <= 2 ? 'soon' : 'trial'}
      >
        {t('trialShort', { days: billing.trialDaysLeft })}
        <span className="sr-only"> · {t('trialCta')}</span>
      </Link>
    );
  }
  if (billing.overLimit) {
    return (
      <aside className={styles.planBanner} data-tone="expired" aria-label={t('label')}>
        <p>{t('expired')}</p>
        <Link href="/app/plan" className={styles.planBannerCta}>
          {t('expiredCta')} <span aria-hidden="true">→</span>
        </Link>
      </aside>
    );
  }
  if (billing.access !== 'trial') return null;
  return (
    <aside
      className={styles.planBanner}
      data-pill-wide=""
      data-tone={billing.trialDaysLeft <= 2 ? 'soon' : 'trial'}
      aria-label={t('label')}
    >
      <p>{t('trial', { days: billing.trialDaysLeft })}</p>
      <Link href="/app/plan" className={styles.planBannerLink}>
        {t('trialCta')}
      </Link>
    </aside>
  );
}
