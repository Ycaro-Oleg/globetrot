'use client';

import { PASSWORD_MIN_LENGTH } from '@globetrot/domain';
import { TextField } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { passwordStrength, strengthKey } from '../../../lib/password-strength';
import styles from '../auth.module.css';

/**
 * A password input with the strength meter under it: four segments and the word, computed here in the browser
 * (nothing is sent anywhere). The meter sits in the field's description, so a screen reader reads it with the
 * field, and its text is a polite live region that changes only when the level changes, not on every key.
 * The meter is guidance: the only rule is the server's length limit.
 */
export function PasswordField({
  value,
  onChange,
  label,
  autoComplete,
  errorMessage,
  showHint = true,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoComplete: 'new-password' | 'current-password';
  errorMessage: string | undefined;
  showHint?: boolean;
}) {
  const t = useTranslations('auth');
  const level = passwordStrength(value);
  const typed = value.length > 0;

  return (
    <TextField
      type="password"
      name="password"
      label={label}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      validationBehavior="aria"
      isInvalid={errorMessage !== undefined}
      errorMessage={errorMessage}
      description={
        <span className={styles.strength}>
          {showHint && <span>{t('signup.passwordHint', { min: PASSWORD_MIN_LENGTH })}</span>}
          {typed && (
            <span className={styles.segments} aria-hidden="true">
              {[1, 2, 3, 4].map((segment) => (
                <span
                  key={segment}
                  className={styles.segment}
                  data-on={segment <= level ? String(level) : '0'}
                />
              ))}
            </span>
          )}
          {/* Always in the page, so the word added to it when typing starts is announced. */}
          <span className={styles.strengthLabel} aria-live="polite">
            {typed ? `${t('strength.label')}: ${t(`strength.${strengthKey(level)}`)}` : ''}
          </span>
        </span>
      }
    />
  );
}
