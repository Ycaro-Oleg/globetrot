import {
  CHECKLIST_GROUPS,
  EXPENSE_CATEGORIES,
  PIP_CHANGES_MAX,
  PIP_REQUEST_MAX,
  PROPOSAL_STATUSES,
} from '@globetrot/domain';
import { z } from 'zod';

const reason = z.string().trim().max(240).default('');
const amount = z
  .string()
  .trim()
  .regex(/^\d{1,9}(\.\d{1,3})?$/);

/**
 * One change Pip may propose. Stops are named by the id they have on the trip. Money is in the trip's currency and
 * always an estimate. What the model answers is parsed through this; anything else is dropped.
 */
export const pipChangeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('addStop'),
    name: z.string().trim().min(1).max(120),
    countryCode: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .nullable()
      .default(null),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    nights: z.number().int().min(0).max(60),
    /** Put it after this stop; null puts it at the end. */
    afterStopId: z.string().nullable().default(null),
    reason,
  }),
  z.object({ kind: z.literal('removeStop'), stopId: z.string(), reason }),
  z.object({
    kind: z.literal('setNights'),
    stopId: z.string(),
    nights: z.number().int().min(0).max(365),
    reason,
  }),
  z.object({ kind: z.literal('reorder'), order: z.array(z.string()).min(2).max(100), reason }),
  z.object({
    kind: z.literal('addPlace'),
    stopId: z.string().nullable().default(null),
    name: z.string().trim().min(1).max(120),
    minutes: z.number().int().min(15).max(720).default(90),
    reason,
  }),
  z.object({
    kind: z.literal('addChecklistItem'),
    group: z.enum(CHECKLIST_GROUPS),
    label: z.string().trim().min(1).max(120),
    reason,
  }),
  z.object({
    kind: z.literal('addExpense'),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(1).max(120),
    amount,
    reason,
  }),
  z.object({ kind: z.literal('setMonthly'), amount, reason }),
]);
export type PipChange = z.infer<typeof pipChangeSchema>;

export const proposalSchema = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  request: z.string(),
  summary: z.string(),
  /** Money in these changes is in the trip's currency and is an estimate, never a live quote. */
  currency: z.string(),
  changes: z.array(pipChangeSchema),
  status: z.enum(PROPOSAL_STATUSES),
  applied: z.array(z.number().int()),
  /** True while "Undo" still works. */
  undoable: z.boolean(),
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
});
export type ProposalView = z.infer<typeof proposalSchema>;

export const proposalListSchema = z.object({ proposals: z.array(proposalSchema) });

export const askPipFields = z.object({
  request: z.string().trim().min(1).max(PIP_REQUEST_MAX).meta({
    description: 'What the person asks Pip, in their own words.',
    example: 'Make this trip ten days and add must-see places in Kyoto',
  }),
});

export const applyProposalFields = z.object({
  include: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(PIP_CHANGES_MAX - 1),
    )
    .max(PIP_CHANGES_MAX)
    .meta({ description: 'Indexes of the changes to apply; the rest are left out.' }),
});
