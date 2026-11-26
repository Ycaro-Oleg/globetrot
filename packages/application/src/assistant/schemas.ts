import {
  CHECKLIST_GROUPS,
  EXPENSE_CATEGORIES,
  PIP_CHANGES_MAX,
  PIP_REQUEST_MAX,
  PROPOSAL_STATUSES,
  SPOT_KINDS,
} from '@globetrot/domain';
import { z } from 'zod';

const reason = z.string().trim().max(240).default('');
/** "Fill this pin": how many real places the map may offer Pip, and how far from the stop they may be. */
export const PIP_SPOT_CANDIDATES_MAX = 40;
export const PIP_SPOT_CANDIDATE_RADIUS_KM = 40;
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
  /**
   * A spot for a stop's pin card: always one of the real places the person's map offered (the model only picks a
   * candidate; the server fills in the name and the place), so nothing is invented.
   */
  z.object({
    kind: z.literal('addSpot'),
    stopId: z.string(),
    name: z.string().trim().min(1).max(120),
    spotKind: z.enum(SPOT_KINDS),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
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

/** A real place near a stop, from the person's map, that Pip may pick as a spot. */
const spotCandidate = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.string().trim().max(40).default(''),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const askPipFields = z.object({
  request: z.string().trim().min(1).max(PIP_REQUEST_MAX).meta({
    description: 'What the person asks Pip, in their own words.',
    example: 'Make this trip ten days and add must-see places in Kyoto',
  }),
  spotCandidates: z
    .object({
      /** The stop, by the `placeKey` it was saved with (unique within the trip). */
      placeKey: z.string().trim().min(1).max(200),
      places: z.array(spotCandidate).min(1).max(PIP_SPOT_CANDIDATES_MAX),
    })
    .optional()
    .meta({
      description:
        `"Fill this pin": real places near one stop, from the map the person sees (at most ${PIP_SPOT_CANDIDATES_MAX}). ` +
        'Pip may then only suggest spots for that stop, chosen among these (places farther than ' +
        `${PIP_SPOT_CANDIDATE_RADIUS_KM} km from the stop are ignored).`,
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
