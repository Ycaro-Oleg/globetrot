import { money, type Money } from '../money/money';
import type { LegMode } from '../trip/destinations';
import {
  SUGGEST_RESEARCHED_ON,
  suggestedDestination,
  type SuggestComfort,
  type SuggestedExperience,
  type SuggestedStop,
  type SuggestLike,
  type UsdRange,
} from './catalog';

/** The shortest and the longest trip a suggestion plans, in days. */
export const SUGGEST_MIN_DAYS = 4;
export const SUGGEST_MAX_DAYS = 21;

export interface SuggestInput {
  readonly destination: string;
  readonly likes: readonly SuggestLike[];
  readonly days: number;
  readonly comfort: SuggestComfort;
}

export interface PlannedStop {
  readonly stop: SuggestedStop;
  readonly nights: number;
  readonly experiences: readonly SuggestedExperience[];
  /** How to reach the next stop of the plan, or null for the last one. */
  readonly next: { readonly mode: LegMode; readonly cost: UsdRange } | null;
}

/** A typical range for the whole trip, per person, in USD. Never a quote. */
export interface CostEstimate {
  readonly low: Money;
  readonly high: Money;
  /** The middle of the range, rounded to whole dollars: what the savings answer uses. */
  readonly middle: Money;
}

export interface SuggestedPlan {
  readonly destination: string;
  readonly days: number;
  readonly nights: number;
  readonly stops: readonly PlannedStop[];
  readonly estimate: CostEstimate;
  /** The day the ranges were researched (shown with the estimate). */
  readonly researchedOn: string;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Up to this many experiences per stop: one more than its nights, never more than four. */
const experienceCap = (nights: number) => clamp(nights + 1, 1, 4);

function pickExperiences(stop: SuggestedStop, likes: readonly SuggestLike[], nights: number) {
  const cap = experienceCap(nights);
  const liked = stop.experiences.filter(
    (experience) => likes.length === 0 || experience.likes.some((like) => likes.includes(like)),
  );
  // What the person likes first, the ones few people talk about before the well known; then, if the stop
  // has room left, its best known experiences, so no stop arrives empty.
  const ranked = [
    ...liked.filter((experience) => experience.offbeat),
    ...liked.filter((experience) => !experience.offbeat),
  ];
  const chosen = ranked.slice(0, cap);
  for (const experience of stop.experiences) {
    if (chosen.length >= Math.min(2, cap)) break;
    if (!experience.offbeat && !chosen.includes(experience)) chosen.push(experience);
  }
  // Shown in the stop's own order, the way a day would run.
  return stop.experiences.filter((experience) => chosen.includes(experience));
}

/** Spreads `total` nights over the stops in proportion to their reference nights, never under their minimum. */
function spreadNights(stops: readonly SuggestedStop[], total: number): number[] {
  const reference = stops.reduce((sum, stop) => sum + stop.nights, 0);
  const nights = stops.map((stop) =>
    Math.max(stop.minNights, Math.round((stop.nights * total) / reference)),
  );
  let difference = total - nights.reduce((sum, value) => sum + value, 0);
  // Rounding leftovers go to (or come from) the stops that matter most, then the longest ones.
  const order = stops
    .map((stop, index) => ({ index, priority: stop.priority, nights: stop.nights }))
    .sort((a, b) => a.priority - b.priority || b.nights - a.nights)
    .map(({ index }) => index);
  for (let guard = 0; difference !== 0 && guard < 100; guard++) {
    for (const index of order) {
      if (difference === 0) break;
      if (difference > 0) {
        nights[index]! += 1;
        difference -= 1;
      } else if (nights[index]! > stops[index]!.minNights) {
        nights[index]! -= 1;
        difference += 1;
      }
    }
  }
  return nights;
}

const dollars = (whole: number) => money(BigInt(Math.round(whole)) * 100n, 'USD');

/**
 * A plan for the chosen destination, likes, length and comfort: which stops and how many nights each, the
 * experiences to suggest in each (the ones few people talk about first), how to move between stops, and a
 * typical cost range per person, flights excluded. Pure: the same input always gives the same plan.
 */
export function suggestPlan(input: SuggestInput): SuggestedPlan | null {
  const destination = suggestedDestination(input.destination);
  if (!destination) return null;
  const days = clamp(Math.round(input.days), SUGGEST_MIN_DAYS, SUGGEST_MAX_DAYS);
  const nightsTotal = days - 1;

  // The stops that fit, by priority, kept in the route's order.
  const byPriority = [...destination.stops].sort((a, b) => a.priority - b.priority);
  const kept = new Set<SuggestedStop>();
  let minimum = 0;
  for (const stop of byPriority) {
    if (minimum + stop.minNights > nightsTotal) continue;
    kept.add(stop);
    minimum += stop.minNights;
  }
  const stops = destination.stops.filter((stop) => kept.has(stop));
  const nights = spreadNights(stops, nightsTotal);

  // A leg to a stop that was left out runs on to the next kept one: its cost is the sum of the legs passed.
  const legBetween = (from: SuggestedStop, to: SuggestedStop) => {
    const start = destination.stops.indexOf(from);
    const end = destination.stops.indexOf(to);
    const legs = destination.legs.slice(start, end);
    return {
      mode: legs[0]!.mode,
      cost: [
        legs.reduce((sum, leg) => sum + leg.cost[0], 0),
        legs.reduce((sum, leg) => sum + leg.cost[1], 0),
      ] as const,
    };
  };

  const planned: PlannedStop[] = stops.map((stop, index) => ({
    stop,
    nights: nights[index]!,
    experiences: pickExperiences(stop, input.likes, nights[index]!),
    next: stops[index + 1] ? legBetween(stop, stops[index + 1]!) : null,
  }));

  let low = 0;
  let high = 0;
  for (const { stop, nights: count, experiences, next } of planned) {
    const daily = stop.daily[input.comfort];
    low += count * (daily.stay[0] + daily.food[0] + daily.local[0]);
    high += count * (daily.stay[1] + daily.food[1] + daily.local[1]);
    for (const experience of experiences) {
      low += experience.cost[0];
      high += experience.cost[1];
    }
    if (next) {
      low += next.cost[0];
      high += next.cost[1];
    }
  }

  return {
    destination: destination.id,
    days,
    nights: nightsTotal,
    stops: planned,
    estimate: { low: dollars(low), high: dollars(high), middle: dollars((low + high) / 2) },
    researchedOn: SUGGEST_RESEARCHED_ON,
  };
}
