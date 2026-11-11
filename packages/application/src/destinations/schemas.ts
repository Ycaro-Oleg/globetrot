import {
  DESTINATION_NAME_MAX_LENGTH,
  DESTINATION_NOTE_MAX_LENGTH,
  LEG_MODES,
  MAX_DESTINATIONS,
  MAX_NIGHTS_PER_DESTINATION,
} from '@globetrot/domain';
import { z } from 'zod';
import type { DestinationRecord } from '../ports';

/** What a client sends for one stop. The server decides ids and positions. */
export const destinationFields = z.object({
  placeKey: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .meta({ description: 'The client’s stable key for the place.', example: 'geoapify:51a1b2' }),
  name: z
    .string()
    .trim()
    .min(1)
    .max(DESTINATION_NAME_MAX_LENGTH)
    .meta({ description: 'Display name of the place.', example: 'Kyoto' }),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable()
    .optional()
    .meta({ description: 'ISO 3166-1 alpha-2, upper case.', example: 'JP' }),
  region: z.string().trim().min(1).max(200).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  nights: z
    .number()
    .int()
    .min(0)
    .max(MAX_NIGHTS_PER_DESTINATION)
    .default(0)
    .meta({ description: 'Nights spent here. Day trips are 0.' }),
  note: z
    .string()
    .trim()
    .max(DESTINATION_NOTE_MAX_LENGTH)
    .nullable()
    .optional()
    .transform((value) => (value ? value : null))
    .meta({ description: 'The person’s note about the stop. Blank is no note.' }),
  legMode: z
    .enum(LEG_MODES)
    .nullable()
    .optional()
    .meta({ description: 'How they travel from this stop to the next. Ignored on the last stop.' }),
});

export const replaceDestinationsBody = z.object({
  destinations: z
    .array(destinationFields)
    .max(MAX_DESTINATIONS)
    .meta({ description: `The whole route, in order (at most ${MAX_DESTINATIONS} stops).` }),
});

export const destinationSchema = z.object({
  id: z.uuid(),
  position: z.number().int(),
  placeKey: z.string(),
  name: z.string(),
  countryCode: z.string().nullable(),
  region: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  nights: z.number().int(),
  note: z.string().nullable(),
  legMode: z.enum(LEG_MODES).nullable(),
});
export type DestinationView = z.infer<typeof destinationSchema>;

export const destinationListSchema = z.object({ destinations: z.array(destinationSchema) });

export const toDestinationView = (record: DestinationRecord): DestinationView => ({
  id: record.id,
  position: record.position,
  placeKey: record.placeKey,
  name: record.name,
  countryCode: record.countryCode,
  region: record.region,
  latitude: record.latitude,
  longitude: record.longitude,
  nights: record.nights,
  note: record.note,
  legMode: (record.legMode as DestinationView['legMode']) ?? null,
});
