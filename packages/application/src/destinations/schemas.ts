import { STOP_PHOTOS_MAX } from '@globetrot/domain';
import { photoFields, photoSchema } from '../media/schemas';
import {
  DESTINATION_NAME_MAX_LENGTH,
  DESTINATION_NOTE_MAX_LENGTH,
  LEG_MODES,
  MAX_DESTINATIONS,
  MAX_NIGHTS_PER_DESTINATION,
  STOP_ITEM_TEXT_MAX_LENGTH,
  STOP_SPOTS_MAX,
  STOP_TODOS_MAX,
} from '@globetrot/domain';
import { z } from 'zod';
import type { DestinationRecord, VisaRecord } from '../ports';

const itemText = z.string().trim().min(1).max(STOP_ITEM_TEXT_MAX_LENGTH);

export const stopSpotSchema = z.object({
  name: itemText.meta({ example: 'Fushimi Inari' }),
  latitude: z.number().min(-90).max(90).nullable().default(null),
  longitude: z.number().min(-180).max(180).nullable().default(null),
  done: z.boolean().default(false),
});

export const stopTodoSchema = z.object({
  text: itemText.meta({ example: 'Book the ryokan' }),
  done: z.boolean().default(false),
});

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
  visited: z.boolean().default(false).meta({
    description:
      'The person marked it visited (their word, not a verification). The first visited stop in a country stamps a commemorative visa.',
  }),
  spots: z
    .array(stopSpotSchema)
    .max(STOP_SPOTS_MAX)
    .default([])
    .meta({ description: `Places to see here (at most ${STOP_SPOTS_MAX}).` }),
  todos: z
    .array(stopTodoSchema)
    .max(STOP_TODOS_MAX)
    .default([])
    .meta({ description: `Things to do for this stop (at most ${STOP_TODOS_MAX}).` }),
  photos: z
    .array(photoFields)
    .max(STOP_PHOTOS_MAX)
    .default([])
    .meta({
      description: `The stop's photos (at most ${STOP_PHOTOS_MAX}): images the caller uploaded (\`POST /v1/media\`).`,
    }),
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
  visited: z.boolean(),
  spots: z.array(
    z.object({
      name: z.string(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      done: z.boolean(),
    }),
  ),
  todos: z.array(z.object({ text: z.string(), done: z.boolean() })),
  photos: z.array(photoSchema),
});
export type DestinationView = z.infer<typeof destinationSchema>;

export const destinationListSchema = z.object({ destinations: z.array(destinationSchema) });

export const visaSchema = z.object({
  countryCode: z.string().meta({ example: 'JP' }),
  city: z.string().meta({ description: 'The stop that stamped it.', example: 'Kyoto' }),
  stampedAt: z.iso.datetime(),
});
export type VisaView = z.infer<typeof visaSchema>;
export const visaListSchema = z.object({
  visas: z.array(visaSchema).meta({
    description:
      'Commemorative Globetrot visas, newest first. Decorative: never an official document.',
  }),
});

/** The stored route, plus the visas this change stamped (empty when it stamped none). */
export const replaceDestinationsResult = destinationListSchema.extend({
  stampedVisas: z.array(visaSchema),
});

export const toVisaView = (record: VisaRecord): VisaView => ({
  countryCode: record.countryCode,
  city: record.city,
  stampedAt: record.stampedAt.toISOString(),
});

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
  visited: record.visited,
  spots: record.spots.map((spot) => ({ ...spot })),
  todos: record.todos.map((todo) => ({ ...todo })),
  photos: record.photos.map((photo) => ({ ...photo })),
});
