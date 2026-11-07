import type { Money } from '../money';
import type { LocalDate } from '../time';
import { emptyDays, plannedStops } from './days';
import { milestones, type MilestoneState } from './milestones';
import { savingsPlan, type SavingsPlan } from './savings';
import type { TripPlan } from './types';

/** The journey line stations, in order. */
export const JOURNEY_STAGES = [
  'dream',
  'explore',
  'connect',
  'plan',
  'save',
  'prepare',
  'ready',
] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Pre-computed inputs, so callers that already derived them don't pay twice. */
export interface DerivationContext {
  readonly plan?: SavingsPlan;
  readonly milestones?: MilestoneState;
}

/**
 * The current station: the first unmet step of
 * [destination, any place, route, every day planned, fully saved, docs + stays + checklist, ready].
 * When everything is met the trip is at `ready`.
 */
export function journeyStage(
  trip: TripPlan,
  today: LocalDate,
  ctx: DerivationContext = {},
): JourneyStage {
  const plan = ctx.plan ?? savingsPlan(trip, today);
  const m = ctx.milestones ?? milestones(trip, today, plan);
  const steps = [
    m.dest,
    plannedStops(trip).some((s) => s.places.length > 0),
    m.route,
    m.itin,
    plan.status !== 'saving',
    m.docs && m.stays && m.check,
    m.ready,
  ];
  const firstUnmet = steps.indexOf(false);
  return JOURNEY_STAGES[firstUnmet === -1 ? JOURNEY_STAGES.length - 1 : firstUnmet] as JourneyStage;
}

/** Structured suggestions; the UI turns each `kind` into localized copy and an action. */
export type NextStep =
  | { readonly kind: 'place-first-pin' }
  | { readonly kind: 'find-stay'; readonly stopId: string }
  | { readonly kind: 'plan-empty-days'; readonly count: number }
  | { readonly kind: 'complete-document'; readonly checklistItemId: string }
  | { readonly kind: 'save-monthly'; readonly amount: Money; readonly departure: LocalDate };

export const MAX_NEXT_STEPS = 4;

/**
 * Up to four next steps in priority order: first pin, the first stop without a bed,
 * empty days, the first unchecked document, the monthly saving needed to be ready in time.
 */
export function nextSteps(
  trip: TripPlan,
  today: LocalDate,
  ctx: DerivationContext = {},
): NextStep[] {
  const plan = ctx.plan ?? savingsPlan(trip, today);
  const stops = plannedStops(trip);
  const steps: NextStep[] = [];

  if (stops.length === 0) steps.push({ kind: 'place-first-pin' });

  const withoutBed = stops.find(
    (s) => s.nights > 0 && !trip.expenses.some((e) => e.category === 'stay' && e.stopId === s.id),
  );
  if (withoutBed) steps.push({ kind: 'find-stay', stopId: withoutBed.id });

  const empty = emptyDays(trip).length;
  if (empty > 0) steps.push({ kind: 'plan-empty-days', count: empty });

  const document = trip.checklist.find((c) => c.group === 'documents' && !c.done);
  if (document) steps.push({ kind: 'complete-document', checklistItemId: document.id });

  if (
    plan.onTime === false &&
    plan.monthlyNeeded !== null &&
    plan.departure !== null &&
    !plan.departed
  ) {
    steps.push({ kind: 'save-monthly', amount: plan.monthlyNeeded, departure: plan.departure });
  }

  return steps.slice(0, MAX_NEXT_STEPS);
}
