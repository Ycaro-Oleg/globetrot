'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

/**
 * The line under the account frame's headline: sign-up (and its "Check your inbox") speaks to someone new, the
 * other account screens to someone coming back.
 */
export function BrandSupporting() {
  const t = useTranslations('auth.brand');
  const pathname = usePathname();
  return <p>{t(pathname === '/signup' ? 'supportingNew' : 'supporting')}</p>;
}
