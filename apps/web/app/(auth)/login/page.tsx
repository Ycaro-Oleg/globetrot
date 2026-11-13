import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../lib/api-proxy';
import { fetchEnabledProviders } from '../../../lib/providers';
import { safeNext } from '../../../lib/safe-next';
import { SITE_NAME } from '../../site';
import { Banner } from '@globetrot/ui/banner';
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
  searchParams: Promise<{
    next?: string | string[];
    error?: string | string[];
    deleted?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const providers = await fetchEnabledProviders({ apiUrl: apiInternalUrl() });
  const t = await getTranslations('auth');
  return (
    <>
      {query.deleted !== undefined ? (
        <Banner tone="success" role="status">
          {t('login.accountDeleted')}
        </Banner>
      ) : null}
      <LoginForm
        next={safeNext(query.next)}
        googleEnabled={providers.includes('google')}
        // Better Auth sends a failed provider callback back here with `?error=<code>`: one message for all of them.
        providerFailed={query.error !== undefined}
      />
    </>
  );
}
