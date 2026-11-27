import {
  isCurrencyCode,
  TRIP_STATUSES,
  TRIP_TITLE_MAX_LENGTH,
  TRIP_VISIBILITIES,
} from '@globetrot/domain';
import { z } from 'zod';
import type { TripRecord } from '../ports';

/** 1 to 120 characters after trimming. Whitespace-only titles are rejected (`too_small`). */
export const titleSchema = z
  .string()
  .trim()
  .min(1)
  .max(TRIP_TITLE_MAX_LENGTH)
  .meta({
    description: `Trimmed, 1 to ${TRIP_TITLE_MAX_LENGTH} characters.`,
    example: 'Japan 2027',
  });

/** A real calendar date `YYYY-MM-DD` with no time zone (so 2027-02-30 is rejected). */
export const dateSchema = z.iso
  .date()
  .meta({ description: 'Calendar date, no time zone.', example: '2027-04-03' });

/** An active ISO 4217 code from the registry in `@globetrot/domain`. */
export const currencySchema = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .refine(isCurrencyCode, { error: 'Unknown currency code' })
  .meta({ description: 'ISO 4217 currency code. Defaults to USD.', example: 'USD' });

export const statusSchema = z.enum(TRIP_STATUSES);

export const tripIdSchema = z.uuid().meta({ description: 'Trip id (UUID).' });

/** The fields a client sends to create a trip. Status and owner are never part of it. */
export const createTripFields = z.object({
  title: titleSchema,
  startDate: dateSchema.nullable().optional(),
  currency: currencySchema.optional(),
});

/** The fields a client may change. Only those present are changed; `startDate: null` clears the date. */
export const updateTripFields = z.object({
  title: titleSchema.optional(),
  startDate: dateSchema.nullable().optional(),
  currency: currencySchema.optional(),
  status: statusSchema.optional(),
});

const hasAChange = (input: z.infer<typeof updateTripFields>) =>
  input.title !== undefined ||
  input.startDate !== undefined ||
  input.currency !== undefined ||
  input.status !== undefined;

/** The body of an update: at least one field. (Not combinable with `extend` or `omit` because of the check.) */
export const updateTripBodySchema = updateTripFields.refine(hasAChange, {
  error: 'Provide at least one field to change',
});
export { hasAChange };

export const tripSchema = z.object({
  id: tripIdSchema,
  title: z.string(),
  startDate: dateSchema.nullable(),
  currency: z.string(),
  status: statusSchema,
  visibility: z.enum(TRIP_VISIBILITIES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** How the caller reaches the trip: its owner, or a member who edits or views it (ADR-0024). */
  role: z.enum(['owner', 'editor', 'viewer']),
});
export type TripView = z.infer<typeof tripSchema>;

/**
 * What a client may know about a trip. The owner id is left out on purpose: a client sees its own trips and the
 * ones shared with it (with its `role`), and the schema drops any field it does not name.
 */
export function toTripView(record: TripRecord, role: TripView['role'] = 'owner'): TripView {
  return {
    id: record.id,
    title: record.title,
    startDate: record.startDate,
    currency: record.currency,
    status: record.status,
    visibility: record.visibility,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    role,
  };
}
