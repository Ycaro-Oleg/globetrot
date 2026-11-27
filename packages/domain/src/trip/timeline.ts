/**
 * What to do as the trip gets closer (ADR-0026): the countdown phases from six months out to the last week, each
 * with the tasks that belong to it. The tasks are suggestions the person can add to their checklist; nothing here
 * claims an entry rule, a price or a deadline set by anyone else.
 */
import { fullMonthsBetween, type LocalDate } from '../time/local-date';

export const TRIP_PHASES = [
  'six-months',
  'three-months',
  'one-month',
  'one-week',
  'travelling',
  'back',
] as const;
export type TripPhase = (typeof TRIP_PHASES)[number];

/** The checklist items each phase suggests, as stable keys (copy lives in the catalogs). */
export const PHASE_TASKS: Readonly<Record<TripPhase, readonly string[]>> = {
  'six-months': ['passport', 'entryRules', 'flights'],
  'three-months': ['insurance', 'stays', 'vaccines'],
  'one-month': ['esim', 'cards', 'transfers'],
  'one-week': ['documents', 'packing', 'offline'],
  travelling: ['dailyCosts', 'photos'],
  back: ['memories', 'settle'],
};

const DAY_MS = 86_400_000;
const days = (from: LocalDate, to: LocalDate) =>
  Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / DAY_MS,
  );

export interface TripCountdown {
  /** Whole days until departure (0 on the day), or null without a start date. */
  readonly daysLeft: number | null;
  readonly phase: TripPhase | null;
  readonly tasks: readonly string[];
}

/**
 * Where a trip stands: days to departure and the phase, from its start date and length in nights. Without a start
 * date there is no countdown.
 */
export function tripCountdown(
  startDate: LocalDate | null,
  nights: number,
  today: LocalDate,
): TripCountdown {
  if (!startDate) return { daysLeft: null, phase: null, tasks: [] };
  const left = days(today, startDate);
  let phase: TripPhase;
  if (left < 0) {
    phase = -left <= nights ? 'travelling' : 'back';
  } else if (left <= 7) phase = 'one-week';
  else if (fullMonthsBetween(today, startDate) < 1) phase = 'one-month';
  else if (fullMonthsBetween(today, startDate) < 3) phase = 'three-months';
  else phase = 'six-months';
  // On the departure day itself the trip has begun.
  if (left === 0) phase = 'travelling';
  return { daysLeft: Math.max(0, left), phase, tasks: PHASE_TASKS[phase] };
}
