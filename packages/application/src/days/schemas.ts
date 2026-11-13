import { z } from 'zod';

/** A trip keeps at most this many places to see, so the day plan stays readable. */
export const DAY_PLACES_MAX = 200;

export const dayPlaceSchema = z.object({
  id: z.uuid(),
  /** The stop it belongs to, or null (none chosen, or the stop was removed from the route). */
  destinationId: z.uuid().nullable(),
  name: z.string(),
  /** Estimated time there, in minutes. */
  minutes: z.number().int(),
  /** 1-based trip day, or null for "No day" (also when the route no longer reaches that day). */
  day: z.number().int().nullable(),
});
export type DayPlaceView = z.infer<typeof dayPlaceSchema>;

export const dayPlanSchema = z.object({
  /** In trip order: within a day, the order the person set. */
  places: z.array(dayPlaceSchema),
});
export type DayPlanView = z.infer<typeof dayPlanSchema>;

export const addDayPlaceFields = z.object({
  name: z.string().trim().min(1).max(120).meta({ example: 'Fushimi Inari' }),
  destinationId: z.uuid().nullable().optional(),
  minutes: z
    .number()
    .int()
    .min(15)
    .max(720)
    .meta({ description: 'Estimated time there, 15 minutes to 12 hours.', example: 120 }),
});

export const moveDayPlaceFields = z.object({
  /** The day to move it to, or null for "No day". */
  day: z.number().int().min(1).nullable(),
  /** Put it just before this place (on the same day); without it, at the end of the day. */
  beforeId: z.uuid().optional(),
});
