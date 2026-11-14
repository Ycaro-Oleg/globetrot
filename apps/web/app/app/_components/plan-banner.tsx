import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { BillingView } from '../../../lib/billing';
import styles from './shell.module.css';

/**
 * One line under the TopBar about the free week: the days left while it runs, and, once it is over without a
 * plan, that the account is read-only and the trips are safe. Nothing for a paid plan.
 */
export function PlanBanner({ billing }: { billing: BillingView | null }) {
  const t = useTranslations('shell.plan');
  if (!billing) return null;
  if (billing.readOnly) {
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
