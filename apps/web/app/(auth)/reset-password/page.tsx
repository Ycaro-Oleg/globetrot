import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '../../site';
import { ResetForm } from '../_components/reset-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: `${t('reset.title')} · ${SITE_NAME}`, robots: { index: false } };
}

/**
 * Where the reset email leads. Better Auth checks the token first and redirects here with `?token=…`, or with
 * `?error=INVALID_TOKEN` when it is expired, used or unknown.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const query = await searchParams;
  const token = typeof query.token === 'string' && query.token !== '' ? query.token : null;
  return <ResetForm token={token} tokenProblem={query.error !== undefined} />;
}
