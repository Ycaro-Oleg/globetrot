import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Banner } from '@globetrot/ui';

/**
 * Placeholder for a legal text. The real Terms and Privacy policy are the owner's to write; until then the
 * page says plainly that it is a draft with no legal effect, so nobody mistakes it for the final text.
 */
export async function DraftPage({ title }: { title: 'termsTitle' | 'privacyTitle' }) {
  const t = await getTranslations('legal');
  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto', padding: '2rem 1.25rem' }}>
      <h1>{t(title)}</h1>
      <Banner tone="info" role="note">
        <strong>{t('draft')}</strong>
      </Banner>
      <p>{t('placeholder')}</p>
      <p>
        <Link href="/signup">{t('back')}</Link>
      </p>
    </main>
  );
}
