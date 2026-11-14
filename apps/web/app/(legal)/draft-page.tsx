import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Banner } from '@globetrot/ui';

/**
 * A legal text, drafted from what the product really does. It stays marked as a draft until the owner fills the
 * [bracketed] facts and a lawyer reviews it, so nobody mistakes it for the final text.
 */
export async function DraftPage({ title }: { title: 'termsTitle' | 'privacyTitle' }) {
  const t = await getTranslations('legal');
  const sections = Object.values(
    t.raw(title === 'termsTitle' ? 'terms' : 'privacy') as Record<string, { h: string; p: string }>,
  );
  return (
    <main style={{ maxWidth: '42rem', margin: '0 auto', padding: '2rem 1.25rem', lineHeight: 1.6 }}>
      <h1>{t(title)}</h1>
      <Banner tone="info" role="note">
        <strong>{t('draft')}</strong>
      </Banner>
      {sections.map((section) => (
        <section key={section.h}>
          <h2 style={{ fontSize: '1.2rem', marginTop: '1.75rem' }}>{section.h}</h2>
          <p>{section.p}</p>
        </section>
      ))}
      <p>
        <Link href="/">{t('back')}</Link>
      </p>
    </main>
  );
}
