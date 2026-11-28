'use client';

import { Banner, Button, SegmentedControl, SelectField, TextField } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { savePreferences } from '../actions';
import { NOT_SET, type Option } from './options';
import styles from './settings.module.css';
import { YourData } from './your-data';

export interface SettingsViewProps {
  readonly values: {
    readonly locale: string;
    readonly currency: string;
    readonly homeCountry: string | null;
    readonly nationality: string | null;
    readonly timeZone: string | null;
    readonly homeCity?: string | null;
    readonly pipOptIn?: boolean;
    readonly weeklyReminder?: boolean;
    readonly pipLook?: unknown;
    readonly pipName?: string | null;
    readonly units: string;
    readonly theme: string;
    readonly motion: string;
  };
  readonly currencies: readonly Option[];
  readonly countries: readonly Option[];
  readonly timeZones: readonly Option[];
  /** `saved`, or `error:<field>,<field>` after a failed save (set by the server action's redirect). */
  readonly status: string | undefined;
  /** The account's email, for the deletion confirmation; null hides "Your data". */
  readonly email?: string | null;
}

/**
 * Provisional layout until the owner reviews the screen spec (#7). Every control is a native-keyboard,
 * labeled field. The fields are independent: none is filled in or changed because of another, and the
 * currency list is the same whatever the language.
 */
export function SettingsView({
  values,
  currencies,
  countries,
  timeZones,
  status,
  email = null,
}: SettingsViewProps) {
  const t = useTranslations('settings');
  const web = useTranslations('webScaffold');

  const notSet: Option = { id: NOT_SET, label: t('notSet') };
  const optional = (options: readonly Option[]) => [notSet, ...options];
  const languages: Option[] = [
    { id: 'en', label: web('english') },
    { id: 'pt-BR', label: web('portuguese') },
  ];
  const units: Option[] = [
    { id: 'metric', label: t('unitsMetric') },
    { id: 'imperial', label: t('unitsImperial') },
  ];
  const themes: Option[] = [
    { id: 'day', label: t('themeDay') },
    { id: 'red-eye', label: t('themeRedEye') },
    { id: 'system', label: t('themeSystem') },
  ];
  const motions: Option[] = [
    { id: 'full', label: t('motionFull') },
    { id: 'reduced', label: t('motionReduced') },
  ];
  const failed = status?.startsWith('error:') ? status.slice('error:'.length) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className={styles.description}>{t('description')}</p>
      </header>
      <section className={styles.sheet} aria-label={t('title')}>
        {status === 'saved' && (
          <Banner tone="success" role="status">
            {t('saved')}
          </Banner>
        )}
        {failed !== null && (
          <Banner tone="error" role="alert">
            {t('error', { fields: failed })}
          </Banner>
        )}

        <form action={savePreferences} className={styles.form}>
          <SelectField
            name="locale"
            label={t('language')}
            description={t('languageHelp')}
            options={languages}
            defaultSelectedKey={values.locale}
          />
          <SelectField
            name="currency"
            label={t('currency')}
            description={t('currencyHelp')}
            options={currencies}
            defaultSelectedKey={values.currency}
          />
          <SelectField
            name="homeCountry"
            label={t('homeCountry')}
            description={t('optionalHelp')}
            options={optional(countries)}
            defaultSelectedKey={values.homeCountry ?? NOT_SET}
          />
          <TextField
            name="homeCity"
            label={t('homeCity')}
            description={t('homeCityHelp')}
            maxLength={120}
            autoComplete="address-level2"
            defaultValue={values.homeCity ?? ''}
          />
          <SelectField
            name="nationality"
            label={t('nationality')}
            description={t('optionalHelp')}
            options={optional(countries)}
            defaultSelectedKey={values.nationality ?? NOT_SET}
          />
          <SelectField
            name="timeZone"
            label={t('timeZone')}
            description={t('timeZoneHelp')}
            options={optional(timeZones)}
            defaultSelectedKey={values.timeZone ?? NOT_SET}
          />
          <SelectField
            name="units"
            label={t('units')}
            options={units}
            defaultSelectedKey={values.units}
          />
          <SegmentedControl
            name="theme"
            label={t('theme')}
            options={themes}
            defaultValue={values.theme}
            description={t('appearanceHelp')}
          />
          <SegmentedControl
            name="motion"
            label={t('motion')}
            options={motions}
            defaultValue={values.motion}
          />
          <SegmentedControl
            name="weeklyReminder"
            label={t('weeklyReminder.label')}
            options={[
              { id: 'on', label: t('weeklyReminder.on') },
              { id: 'off', label: t('weeklyReminder.off') },
            ]}
            defaultValue={values.weeklyReminder === false ? 'off' : 'on'}
            description={t('weeklyReminder.hint')}
          />
          <div className={styles.actions}>
            <Button type="submit" variant="cta">
              {t('save')}
            </Button>
          </div>
        </form>
      </section>
      {email ? <YourData email={email} /> : null}
    </div>
  );
}
