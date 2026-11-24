import {
  DEFAULT_PIP_LOOK,
  PIP_BAG_COLORS,
  PIP_BAGS,
  PIP_HATS,
  PIP_OUTFITS,
  toPipLook,
  DEFAULT_CURRENCY,
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  DEFAULT_UNIT_SYSTEM,
  isCountryCode,
  isCurrencyCode,
  isTimeZone,
  MOTION_CHOICES,
  THEME_CHOICES,
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

export const pipLookSchema = z.object({
  hat: z.enum(PIP_HATS),
  outfit: z.enum(PIP_OUTFITS),
  bag: z.enum(PIP_BAGS),
  bagColor: z.enum(PIP_BAG_COLORS),
});

export const unitsSchema = z.enum(UNIT_SYSTEMS);
export const themeSchema = z.enum(THEME_CHOICES).meta({
  description: 'Look of the app: a designed theme, or `system` to follow the OS.',
  example: 'system',
});
export const motionSchema = z.enum(MOTION_CHOICES).meta({
  description: 'Amount of animation. The OS reduced-motion setting wins over `full`.',
  example: 'full',
});

/** Every field of the stored preferences. Country, nationality and time zone are optional (null). */
export const preferencesSchema = z.object({
  locale: z.string(),
  currency: z.string(),
  homeCountry: z.string().nullable(),
  nationality: z.string().nullable(),
  timeZone: z.string().nullable(),
  units: unitsSchema,
  theme: themeSchema,
  motion: motionSchema,
  homeCity: z.string().nullable(),
  pipOptIn: z.boolean(),
  pipLook: pipLookSchema,
  pipName: z.string().nullable(),
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
  theme: themeSchema.optional(),
  motion: motionSchema.optional(),
  homeCity: z.string().trim().min(1).max(120).nullable().optional().meta({
    description: 'The city the person usually leaves from; null clears it.',
    example: 'São Paulo',
  }),
  pipOptIn: z
    .boolean()
    .optional()
    .meta({ description: 'Whether the person wants Pip’s suggestions.' }),
  pipLook: pipLookSchema
    .optional()
    .meta({ description: 'The person’s Pip: hat, outfit, bag and bag colour.' }),
  pipName: z.string().trim().min(1).max(16).nullable().optional().meta({
    description: 'Pip’s name, 1 to 16 characters; null brings back “Pip”.',
    example: 'Pipoca',
  }),
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
  theme: DEFAULT_THEME_CHOICE,
  motion: DEFAULT_MOTION_CHOICE,
  homeCity: null,
  pipOptIn: false,
  pipLook: { ...DEFAULT_PIP_LOOK },
  pipName: null,
};

export const toPreferencesView = (record: PreferencesRecord): PreferencesView => ({
  locale: record.locale,
  currency: record.currency,
  homeCountry: record.homeCountry,
  nationality: record.nationality,
  timeZone: record.timeZone,
  units: record.units,
  theme: record.theme,
  motion: record.motion,
  homeCity: record.homeCity,
  pipOptIn: record.pipOptIn,
  pipLook: toPipLook(record.pipLook),
  pipName: record.pipName,
});
