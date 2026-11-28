'use client';

import { isMotionChoice, isThemeChoice } from '@globetrot/domain';
import { Banner, Button, SegmentedControl, SelectField, TextField } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { applyMotion, applyTheme, switchAppearance } from '../../lib/appearance';
import { saveAppearance, savePreferences } from '../actions';
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

  // Theme and motion apply as soon as they are picked and are saved at once, without "Save". A failed save puts the
  // previous choice back on the page and in the control; the live line says which happened.
  const [theme, setTheme] = useState(values.theme);
  const [motion, setMotion] = useState(values.motion);
  const [note, setNote] = useState<
    'themeSaved' | 'themeSaveFailed' | 'motionSaved' | 'motionSaveFailed' | null
  >(null);
  const pickTheme = (value: string) => {
    if (!isThemeChoice(value) || value === theme) return;
    const previous = isThemeChoice(theme) ? theme : 'system';
    setTheme(value);
    setNote(null);
    void switchAppearance(value, previous, applyTheme, (choice) =>
      saveAppearance('theme', choice),
    ).then((kept) => {
      if (!kept) setTheme(previous);
      setNote(kept ? 'themeSaved' : 'themeSaveFailed');
    });
  };
  const pickMotion = (value: string) => {
    if (!isMotionChoice(value) || value === motion) return;
    const previous = isMotionChoice(motion) ? motion : 'full';
    setMotion(value);
    setNote(null);
    void switchAppearance(
      value,
      previous,
      (choice) => applyMotion(choice),
      (choice) => saveAppearance('motion', choice),
    ).then((kept) => {
      if (!kept) setMotion(previous);
      setNote(kept ? 'motionSaved' : 'motionSaveFailed');
    });
  };

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
            value={theme}
            onChange={pickTheme}
          />
          <SegmentedControl
            name="motion"
            label={t('motion')}
            options={motions}
            value={motion}
            onChange={pickMotion}
          />
          <p className={styles.description}>{t('appearanceHelp')}</p>
          <p className={styles.description} role="status">
            {note ? t(note) : null}
          </p>
          <SegmentedControl
            name="weeklyReminder"
            label={t('weeklyReminder.label')}
            options={[
              { id: 'on', label: t('weeklyReminder.on') },
              { id: 'off', label: t('weeklyReminder.off') },
            ]}
            defaultValue={values.weeklyReminder === false ? 'off' : 'on'}
          />
          <p className={styles.description}>{t('weeklyReminder.hint')}</p>
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
