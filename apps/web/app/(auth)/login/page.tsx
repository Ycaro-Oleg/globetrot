import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchEnabledProviders } from '../../../lib/providers';
import { safeNext } from '../../../lib/safe-next';
import { SITE_NAME } from '../../site';
import { LoginForm } from '../_components/login-form';

// Depends on the language cookie and on which providers the API offers.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: `${t('login.title')} · ${SITE_NAME}` };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const query = await searchParams;
  const providers = await fetchEnabledProviders({ apiUrl: apiInternalUrl() });
  return <LoginForm next={safeNext(query.next)} googleEnabled={providers.includes('google')} />;
}
