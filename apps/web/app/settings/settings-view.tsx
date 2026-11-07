'use client';

import { Banner, Button, SelectField } from '@globetrot/ui';
import { useTranslations } from 'next-intl';
import { savePreferences } from '../actions';
import { NOT_SET, type Option } from './options';

export interface SettingsViewProps {
  readonly values: {
    readonly locale: string;
    readonly currency: string;
    readonly homeCountry: string | null;
    readonly nationality: string | null;
    readonly timeZone: string | null;
    readonly units: string;
  };
  readonly currencies: readonly Option[];
  readonly countries: readonly Option[];
  readonly timeZones: readonly Option[];
  /** `saved`, or `error:<field>,<field>` after a failed save (set by the server action's redirect). */
  readonly status: string | undefined;
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
  const failed = status?.startsWith('error:') ? status.slice('error:'.length) : null;

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>

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

      <form action={savePreferences}>
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
        <Button type="submit">{t('save')}</Button>
      </form>
    </main>
  );
}
