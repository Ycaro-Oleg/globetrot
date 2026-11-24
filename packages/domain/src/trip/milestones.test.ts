import { describe, expect, it } from 'vitest';
import { fromDecimal } from '../money';
import { toLocalDate } from '../time';
import { JAPAN_TODAY, japanDemo, japanReady } from './__fixtures__/japan-demo';
import { MILESTONES, milestones, recordStamps, type MilestoneState } from './milestones';
import type { TripPlan } from './types';

const earned = (m: MilestoneState) => MILESTONES.filter((k) => m[k]);

describe('milestones', () => {
  it('gives the Japan demo 4 of 9 stamps, like the prototype', () => {
    expect(earned(milestones(japanDemo(), JAPAN_TODAY))).toEqual([
      'dest',
      'route',
      'budget',
      'saved',
    ]);
  });

  it('plans "every day" without a place on the departure day, but never for a route of day trips only', () => {
    const planned: TripPlan = {
      ...japanDemo(),
      stops: [{ id: 'a', nights: 1, state: 'planned', places: [{ id: 'p', day: 1, done: false }] }],
    };
    expect(milestones(planned, JAPAN_TODAY).itin).toBe(true);
    const dayTrip: TripPlan = {
      ...japanDemo(),
      stops: [{ id: 'sintra', nights: 0, state: 'planned', places: [] }],
    };
    expect(milestones(dayTrip, JAPAN_TODAY).itin).toBe(false);
  });

  it('earns all nine once every gap is closed', () => {
    expect(earned(milestones(japanReady(), JAPAN_TODAY))).toEqual([...MILESTONES]);
  });

  it('withholds "ready" while money is still missing', () => {
    const trip: TripPlan = {
      ...japanReady(),
      savings: { ...japanReady().savings, saved: fromDecimal('14279.99', 'BRL') },
    };
    const m = milestones(trip, JAPAN_TODAY);
    expect(m.check && m.docs && m.stays && m.itin).toBe(true);
    expect(m.ready).toBe(false);
  });

  describe('saved: at least 10% of the total (currency-neutral)', () => {
    const at = (saved: string) =>
      milestones(
        { ...japanDemo(), savings: { ...japanDemo().savings, saved: fromDecimal(saved, 'BRL') } },
        JAPAN_TODAY,
      ).saved;

    it('is earned at exactly 10%', () => expect(at('1370')).toBe(true));
    it('is not earned just below 10%', () => expect(at('1369.99')).toBe(false));
    it('is not earned with nothing saved', () => expect(at('0')).toBe(false));
    it('is not earned without costs', () => {
      expect(milestones({ ...japanDemo(), expenses: [] }, JAPAN_TODAY).saved).toBe(false);
    });
  });

  it('needs at least one planned stop, and a route needs two', () => {
    const one: TripPlan = { ...japanDemo(), stops: [japanDemo().stops[0]!] };
    const m = milestones(one, JAPAN_TODAY);
    expect([m.dest, m.route]).toEqual([true, false]);
    const none = milestones({ ...japanDemo(), stops: [] }, JAPAN_TODAY);
    expect([none.dest, none.itin, none.stays]).toEqual([false, false, false]);
  });

  it('does not ask for a bed on day trips', () => {
    const trip: TripPlan = {
      ...japanReady(),
      stops: [...japanReady().stops, { id: 'nara', nights: 0, state: 'planned', places: [] }],
    };
    expect(milestones(trip, JAPAN_TODAY).stays).toBe(true);
    const onlyDayTrip: TripPlan = {
      ...japanDemo(),
      stops: [{ id: 'nara', nights: 0, state: 'planned', places: [] }],
    };
    expect(milestones(onlyDayTrip, JAPAN_TODAY).stays).toBe(false);
  });

  it('needs non-empty checklists for docs and check', () => {
    const m = milestones({ ...japanReady(), checklist: [] }, JAPAN_TODAY);
    expect([m.docs, m.check, m.ready]).toEqual([false, false, false]);
  });
});

describe('recordStamps', () => {
  const day1 = toLocalDate('2026-11-07');
  const day2 = toLocalDate('2026-12-01');

  it('records first-time stamps with today’s date, in display order', () => {
    const first = recordStamps(milestones(japanDemo(), day1), {}, day1);
    expect(first.newlyEarned).toEqual(['dest', 'route', 'budget', 'saved']);
    expect(first.stamps).toEqual({ dest: day1, route: day1, budget: day1, saved: day1 });
  });

  it('keeps original dates and never takes a stamp back', () => {
    const first = recordStamps(milestones(japanDemo(), day1), {}, day1);
    const later = milestones({ ...japanReady(), stops: japanReady().stops.slice(0, 1) }, day2);
    const second = recordStamps(later, first.stamps, day2);
    expect(later.route).toBe(false);
    expect(second.stamps.route).toBe(day1);
    expect(second.stamps.dest).toBe(day1);
    // Tokyo-only trip: route drops to false, but docs, stays, itinerary and checklist are newly complete.
    expect(second.newlyEarned).toEqual(['docs', 'stays', 'itin', 'check']);
    expect(second.stamps.docs).toBe(day2);
  });
});
