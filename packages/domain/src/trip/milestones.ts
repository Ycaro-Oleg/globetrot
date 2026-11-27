import { compare, isZero, multiply, type Money } from '../money';
import type { LocalDate } from '../time';
import { emptyDays, plannedStops, tripDays } from './days';
import { savingsPlan, type SavingsPlan } from './savings';
import { tripTotals } from './totals';
import type { TripPlan } from './types';

/** The nine readiness stamps on a trip's visa page, in display order. */
export const MILESTONES = [
  'dest',
  'route',
  'budget',
  'saved',
  'docs',
  'stays',
  'itin',
  'check',
  'ready',
] as const;
export type MilestoneKey = (typeof MILESTONES)[number];
export type MilestoneState = Readonly<Record<MilestoneKey, boolean>>;
/** When each stamp was first earned. Stamps are never taken back once recorded. */
export type StampRecord = Readonly<Partial<Record<MilestoneKey, LocalDate>>>;

/** Share of the total that earns the `saved` stamp (replaces the prototype's fixed "R$ 1,000"). */
const SAVED_STAMP_FRACTION = '0.10';

function savedEnoughForStamp(saved: Money, total: Money): boolean {
  if (isZero(total) || saved.amountMinor <= 0n) return false;
  return compare(saved, multiply(total, SAVED_STAMP_FRACTION)) >= 0;
}

/** Evaluates every readiness milestone (business rules: Readiness milestones). */
export function milestones(
  trip: TripPlan,
  today: LocalDate,
  plan: SavingsPlan = savingsPlan(trip, today),
): MilestoneState {
  const stops = plannedStops(trip);
  const days = tripDays(trip);
  const documents = trip.checklist.filter((c) => c.group === 'documents');
  const stopsNeedingBed = stops.filter((s) => s.nights > 0);
  const hasStay = (stopId: string) =>
    trip.expenses.some((e) => e.category === 'stay' && e.stopId === stopId);

  const state = {
    dest: stops.length >= 1,
    route: stops.length >= 2,
    budget: trip.expenses.length >= 1,
    saved: savedEnoughForStamp(trip.savings.saved, tripTotals(trip).total),
    docs: documents.length > 0 && documents.every((c) => c.done),
    stays: stopsNeedingBed.length > 0 && stopsNeedingBed.every((s) => hasStay(s.id)),
    // Every night's day has a place; the departure day is optional, and a route of day trips only has none to plan.
    itin: days.some((day) => !day.departure) && emptyDays(trip).length === 0,
    check: trip.checklist.length > 0 && trip.checklist.every((c) => c.done),
  };
  const ready = Object.values(state).every(Boolean) && isZero(plan.left);
  return { ...state, ready };
}

export interface StampUpdate {
  readonly stamps: StampRecord;
  /** Milestones earned for the first time now, in display order (drives the celebration queue). */
  readonly newlyEarned: MilestoneKey[];
}

/** Records first-time milestones with today's date. Existing stamps keep their original date. */
export function recordStamps(
  current: MilestoneState,
  stamps: StampRecord,
  today: LocalDate,
): StampUpdate {
  const next: Partial<Record<MilestoneKey, LocalDate>> = { ...stamps };
  const newlyEarned: MilestoneKey[] = [];
  for (const key of MILESTONES) {
    if (current[key] && next[key] === undefined) {
      next[key] = today;
      newlyEarned.push(key);
    }
  }
  return { stamps: next, newlyEarned };
}
