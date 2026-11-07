import {
  DEFAULT_CURRENCY,
  DEFAULT_UNIT_SYSTEM,
  isCountryCode,
  isCurrencyCode,
  isTimeZone,
  UNIT_SYSTEMS,
} from '@globetrot/domain';
import { DEFAULT_LOCALE, isSupportedLocale, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { z } from 'zod';
import type { PreferencesRecord } from '../ports';

export const localeSchema = z
  .string()
  .refine(isSupportedLocale, {
    error: `Unsupported language. Use one of: ${SUPPORTED_LOCALES.join(', ')}`,
  })
  .meta({ description: 'Interface language.', example: 'pt-BR' });

export const preferredCurrencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(isCurrencyCode, { error: 'Unknown currency code' })
  .meta({ description: 'Default currency for new trips (ISO 4217).', example: 'USD' });

export const countrySchema = z
  .string()
  .regex(/^[A-Z]{2}$/)
  .refine(isCountryCode, { error: 'Unknown country code' })
  .meta({ description: 'ISO 3166-1 alpha-2 country code.', example: 'BR' });

export const timeZoneSchema = z
  .string()
  .refine(isTimeZone, { error: 'Unknown time zone' })
  .meta({ description: 'IANA time zone name.', example: 'America/Sao_Paulo' });

export const unitsSchema = z.enum(UNIT_SYSTEMS);

/** Every field of the stored preferences. Country, nationality and time zone are optional (null). */
export const preferencesSchema = z.object({
  locale: z.string(),
  currency: z.string(),
  homeCountry: z.string().nullable(),
  nationality: z.string().nullable(),
  timeZone: z.string().nullable(),
  units: unitsSchema,
});
export type PreferencesView = z.infer<typeof preferencesSchema>;

/**
 * What a client may change. Only the fields present change, and **no field affects another**: choosing a
 * language never touches the currency, the country or the nationality. `null` clears an optional field.
 */
export const updatePreferencesFields = z.object({
  locale: localeSchema.optional(),
  currency: preferredCurrencySchema.optional(),
  homeCountry: countrySchema.nullable().optional(),
  nationality: countrySchema.nullable().optional(),
  timeZone: timeZoneSchema.nullable().optional(),
  units: unitsSchema.optional(),
});

export const hasAPreferenceChange = (input: z.infer<typeof updatePreferencesFields>) =>
  Object.values(input).some((value) => value !== undefined);

/** At least one field. (Not combinable with `extend` or `omit` because of the check.) */
export const updatePreferencesBodySchema = updatePreferencesFields.refine(hasAPreferenceChange, {
  error: 'Provide at least one field to change',
});

/** What a user has before saving anything: USD, the default language, no country, nationality or time zone. */
export const DEFAULT_PREFERENCES: PreferencesView = {
  locale: DEFAULT_LOCALE,
  currency: DEFAULT_CURRENCY,
  homeCountry: null,
  nationality: null,
  timeZone: null,
  units: DEFAULT_UNIT_SYSTEM,
};

export const toPreferencesView = (record: PreferencesRecord): PreferencesView => ({
  locale: record.locale,
  currency: record.currency,
  homeCountry: record.homeCountry,
  nationality: record.nationality,
  timeZone: record.timeZone,
  units: record.units,
});
