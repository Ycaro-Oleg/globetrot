import { useLocale, useTranslations } from 'next-intl';
import { setScaffoldLocale } from './actions';
import { SITE_NAME } from './site';

// Temporary scaffold; the landing and authenticated app are separate roadmap work.
export default function HomePage() {
  const t = useTranslations('webScaffold');
  const locale = useLocale();
  return (
    <main>
      <h1>{SITE_NAME}</h1>
      <h2>{t('headline')}</h2>
      <p>{t('description')}</p>
      <form action={setScaffoldLocale} aria-label={t('language')}>
        <button type="submit" name="locale" value="en" aria-pressed={locale === 'en'}>
          {t('english')}
        </button>
        <button type="submit" name="locale" value="pt-BR" aria-pressed={locale === 'pt-BR'}>
          {t('portuguese')}
        </button>
      </form>
    </main>
  );
}
