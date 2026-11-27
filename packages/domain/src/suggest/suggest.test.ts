import { describe, expect, it } from 'vitest';
import { convert } from '../money/exchange-rate';
import { SPOT_KINDS } from '../trip/destinations';
import { SUGGEST_LIKES, SUGGESTED_DESTINATIONS } from './catalog';
import { suggestPlan } from './plan';
import { suggestReferenceRate } from './rates';

const usd = (minor: bigint) => Number(minor / 100n);

describe('the suggested plans catalog', () => {
  it('is complete: ranges low to high, a leg between each pair of stops, real kinds and likes, unique ids', () => {
    const ids = new Set<string>();
    for (const destination of SUGGESTED_DESTINATIONS) {
      expect(destination.legs).toHaveLength(destination.stops.length - 1);
      expect(destination.stops.some((stop) => stop.priority === 1)).toBe(true);
      for (const leg of destination.legs) expect(leg.cost[0]).toBeLessThanOrEqual(leg.cost[1]);
      for (const stop of destination.stops) {
        expect(stop.minNights).toBeLessThanOrEqual(stop.nights);
        for (const daily of Object.values(stop.daily))
          for (const range of [daily.stay, daily.food, daily.local])
            expect(range[0]).toBeLessThanOrEqual(range[1]);
        expect(stop.experiences.some((experience) => experience.offbeat)).toBe(true);
        for (const experience of stop.experiences) {
          expect(ids.has(experience.id)).toBe(false);
          ids.add(experience.id);
          expect(SPOT_KINDS).toContain(experience.kind);
          expect(experience.likes.length).toBeGreaterThan(0);
          for (const like of experience.likes) expect(SUGGEST_LIKES).toContain(like);
          expect(experience.cost[0]).toBeLessThanOrEqual(experience.cost[1]);
        }
      }
    }
  });
});

describe('suggestPlan', () => {
  it('plans every stop for a long enough trip, nights adding up to the days minus one', () => {
    const plan = suggestPlan({ destination: 'japan', likes: [], days: 12, comfort: 'budget' })!;
    expect(plan.stops.map((stop) => stop.stop.key)).toEqual(['tokyo', 'hakone', 'kyoto', 'osaka']);
    expect(plan.nights).toBe(11);
    expect(plan.stops.reduce((sum, stop) => sum + stop.nights, 0)).toBe(11);
    expect(plan.stops.at(-1)!.next).toBeNull();
    expect(plan.stops[0]!.next).toEqual({ mode: 'train', cost: [15, 30] });
  });

  it('drops the optional stops first on a short trip and joins the legs around them', () => {
    const plan = suggestPlan({ destination: 'japan', likes: [], days: 5, comfort: 'budget' })!;
    expect(plan.stops.map((stop) => stop.stop.key)).toEqual(['tokyo', 'kyoto']);
    expect(plan.stops.reduce((sum, stop) => sum + stop.nights, 0)).toBe(4);
    // Tokyo to Kyoto runs through the Hakone legs: 15–30 + 70–80.
    expect(plan.stops[0]!.next).toEqual({ mode: 'train', cost: [85, 110] });
  });

  it('suggests what the person likes, the ones few people talk about first', () => {
    const plan = suggestPlan({
      destination: 'japan',
      likes: ['adrenaline'],
      days: 12,
      comfort: 'budget',
    })!;
    const tokyo = plan.stops[0]!.experiences.map((experience) => experience.id);
    expect(tokyo).toContain('tokyo-daikoku');
    expect(tokyo).toContain('tokyo-ebisu-drift');
    const kyoto = plan.stops.find((stop) => stop.stop.key === 'kyoto')!.experiences;
    expect(kyoto.map((experience) => experience.id)).toContain('kyoto-hozugawa');
  });

  it('never leaves a stop empty: its best known experiences fill in', () => {
    const plan = suggestPlan({
      destination: 'portugal',
      likes: ['nightlife'],
      days: 9,
      comfort: 'budget',
    })!;
    for (const stop of plan.stops) expect(stop.experiences.length).toBeGreaterThan(0);
  });

  it('adds up a range per person: nights × daily costs, experiences and legs; comfort costs more', () => {
    const budget = suggestPlan({
      destination: 'portugal',
      likes: ['food'],
      days: 8,
      comfort: 'budget',
    })!;
    const comfort = suggestPlan({
      destination: 'portugal',
      likes: ['food'],
      days: 8,
      comfort: 'comfort',
    })!;
    let low = 0;
    let high = 0;
    for (const stop of budget.stops) {
      const daily = stop.stop.daily.budget;
      low += stop.nights * (daily.stay[0] + daily.food[0] + daily.local[0]);
      high += stop.nights * (daily.stay[1] + daily.food[1] + daily.local[1]);
      for (const experience of stop.experiences) {
        low += experience.cost[0];
        high += experience.cost[1];
      }
      if (stop.next) {
        low += stop.next.cost[0];
        high += stop.next.cost[1];
      }
    }
    expect(usd(budget.estimate.low.amountMinor)).toBe(low);
    expect(usd(budget.estimate.high.amountMinor)).toBe(high);
    expect(usd(budget.estimate.middle.amountMinor)).toBe(Math.round((low + high) / 2));
    expect(budget.estimate.low.currency).toBe('USD');
    expect(comfort.estimate.middle.amountMinor).toBeGreaterThan(budget.estimate.middle.amountMinor);
  });

  it('keeps the length within bounds and answers null for an unknown destination', () => {
    expect(suggestPlan({ destination: 'japan', likes: [], days: 1, comfort: 'budget' })!.days).toBe(
      4,
    );
    expect(
      suggestPlan({ destination: 'japan', likes: [], days: 90, comfort: 'budget' })!.days,
    ).toBe(21);
    expect(suggestPlan({ destination: 'mars', likes: [], days: 9, comfort: 'budget' })).toBeNull();
  });
});

describe('suggestReferenceRate', () => {
  it('converts an estimate with a recorded rate, source and date; none for USD', () => {
    const rate = suggestReferenceRate('BRL')!;
    expect(rate.source).toMatch(/European Central Bank/);
    expect(rate.asOf.toISOString().slice(0, 10)).toBe('2026-11-26');
    const plan = suggestPlan({ destination: 'japan', likes: [], days: 10, comfort: 'budget' })!;
    const converted = convert(plan.estimate.middle, rate).converted;
    expect(converted.currency).toBe('BRL');
    expect(converted.amountMinor).toBeGreaterThan(plan.estimate.middle.amountMinor);
    expect(suggestReferenceRate('USD')).toBeNull();
  });
});
