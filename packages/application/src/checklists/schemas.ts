import { CHECKLIST_GROUPS, MILESTONES } from '@globetrot/domain';
import { z } from 'zod';

/** A trip keeps at most this many checklist items, so a list stays something a person can read. */
export const CHECKLIST_MAX_ITEMS = 100;

const labelSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .meta({ example: 'Passport valid for 6 months' });

export const checklistItemSchema = z.object({
  id: z.uuid(),
  group: z.enum(CHECKLIST_GROUPS),
  label: z.string(),
  done: z.boolean(),
});
export type ChecklistItemView = z.infer<typeof checklistItemSchema>;

export const addChecklistItemsFields = z.object({
  items: z
    .array(z.object({ group: z.enum(CHECKLIST_GROUPS), label: labelSchema }))
    .min(1)
    .max(30)
    .meta({ description: 'One or several items, for example a suggested starter list.' }),
});

export const updateChecklistItemFields = z
  .object({ done: z.boolean().optional(), label: labelSchema.optional() })
  .refine((value) => value.done !== undefined || value.label !== undefined, {
    error: 'Provide at least one field to change',
  });

export const checklistSchema = z.object({
  items: z.array(checklistItemSchema),
  /** The nine readiness stamps as they stand now, computed from what the trip has today. */
  readiness: z.record(z.enum(MILESTONES), z.boolean()),
  /**
   * Stamps this change earned for the very first time (recorded now with today's date). Only these are
   * celebrated: a stamp that comes off and back is not new. Always empty when only reading.
   */
  firstTime: z.array(z.enum(MILESTONES)),
});
export type ChecklistView = z.infer<typeof checklistSchema>;
