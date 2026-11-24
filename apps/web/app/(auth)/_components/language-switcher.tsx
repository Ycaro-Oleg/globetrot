import { useLocale, useTranslations } from 'next-intl';
import { setScaffoldLocale } from '../../actions';
import styles from '../auth.module.css';

/**
 * Switches the interface language with the existing cookie mechanism. It changes only the language: not the
 * currency, the country or anything else. The names stay in their own language so people can find theirs.
 */
export function LanguageSwitcher() {
  const t = useTranslations('auth');
  const web = useTranslations('webScaffold');
  const locale = useLocale();
  return (
    <form action={setScaffoldLocale} aria-label={t('language')} className={styles.language}>
      <button type="submit" name="locale" value="en" aria-pressed={locale === 'en'}>
        {web('english')}
      </button>
      <button type="submit" name="locale" value="pt-BR" aria-pressed={locale === 'pt-BR'}>
        {web('portuguese')}
      </button>
    </form>
  );
}
