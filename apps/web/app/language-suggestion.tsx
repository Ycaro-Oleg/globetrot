import { catalogs, type SupportedLocale } from '@globetrot/i18n';
import { setScaffoldLocale } from './actions';
import styles from './language-suggestion.module.css';

/**
 * A quiet offer, written in the language it offers, for a visitor who has never chosen one and whose browser
 * prefers another supported language. Nothing changes until they pick: either answer is stored as their choice,
 * so the offer does not come back (business rules: Locale and currency; detected values are suggestions).
 */
export function LanguageSuggestion({
  suggested,
  current,
}: {
  readonly suggested: SupportedLocale;
  readonly current: SupportedLocale;
}) {
  const copy = catalogs[suggested].languageSuggestion;
  return (
    <form
      action={setScaffoldLocale}
      className={styles.bar}
      lang={suggested}
      aria-label={copy.label}
    >
      <p>{copy.text}</p>
      <div className={styles.actions}>
        <button type="submit" name="locale" value={suggested} className={styles.switch}>
          {copy.switch}
        </button>
        <button type="submit" name="locale" value={current} className={styles.keep}>
          {copy.keep}
        </button>
      </div>
    </form>
  );
}
