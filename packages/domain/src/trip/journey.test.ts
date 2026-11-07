import { describe, expect, it } from 'vitest';
import { fromDecimal } from '../money';
import { JAPAN_TODAY, japanDemo, japanReady } from './__fixtures__/japan-demo';
import { journeyStage, MAX_NEXT_STEPS, nextSteps } from './journey';
import { milestones } from './milestones';
import { savingsPlan } from './savings';
import type { TripPlan } from './types';

const empty: TripPlan = { ...japanDemo(), stops: [], expenses: [], checklist: [] };

describe('journeyStage', () => {
  it('puts the Japan demo at "plan", like the prototype’s journey line', () => {
    expect(journeyStage(japanDemo(), JAPAN_TODAY)).toBe('plan');
  });

  it.each<[string, TripPlan, string]>([
    ['an empty trip dreams', empty, 'dream'],
    [
      'a stop without places explores',
      { ...empty, stops: [{ id: 'a', nights: 2, state: 'planned', places: [] }] },
      'explore',
    ],
    [
      'one stop with places connects',
      {
        ...empty,
        stops: [
          { id: 'a', nights: 1, state: 'planned', places: [{ id: 'p', day: 1, done: false }] },
        ],
      },
      'connect',
    ],
    [
      'a fully planned but unpaid trip saves',
      { ...japanReady(), savings: { ...japanReady().savings, saved: fromDecimal('100', 'BRL') } },
      'save',
    ],
    [
      'a saved trip with open checklist items prepares',
      { ...japanReady(), checklist: japanReady().checklist.map((c, i) => ({ ...c, done: i > 0 })) },
      'prepare',
    ],
    ['a complete trip is ready', japanReady(), 'ready'],
  ])('%s', (_, trip, stage) => {
    expect(journeyStage(trip, JAPAN_TODAY)).toBe(stage);
  });

  it('accepts pre-computed context', () => {
    const plan = savingsPlan(japanDemo(), JAPAN_TODAY);
    const m = milestones(japanDemo(), JAPAN_TODAY, plan);
    expect(journeyStage(japanDemo(), JAPAN_TODAY, { plan })).toBe('plan');
    expect(journeyStage(japanDemo(), JAPAN_TODAY, { plan, milestones: m })).toBe('plan');
    expect(nextSteps(japanDemo(), JAPAN_TODAY, { plan })).toHaveLength(4);
  });
});

describe('nextSteps', () => {
  it('lists the Japan demo’s four next stamps in priority order', () => {
    expect(nextSteps(japanDemo(), JAPAN_TODAY)).toEqual([
      { kind: 'find-stay', stopId: 'osaka' },
      { kind: 'plan-empty-days', count: 3 },
      { kind: 'complete-document', checklistItemId: 'passport' },
      { kind: 'save-monthly', amount: fromDecimal('1830', 'BRL'), departure: '2027-04-03' },
    ]);
  });

  it('starts an empty trip with the first pin', () => {
    expect(nextSteps(empty, JAPAN_TODAY)).toEqual([{ kind: 'place-first-pin' }]);
  });

  it('has nothing to suggest for a ready trip', () => {
    expect(nextSteps(japanReady(), JAPAN_TODAY)).toEqual([]);
  });

  it('skips the savings step when on time, without dates, or after departure', () => {
    const onTime = {
      ...japanDemo(),
      savings: { ...japanDemo().savings, monthly: fromDecimal('2000', 'BRL') },
    };
    const kinds = (t: TripPlan, today = JAPAN_TODAY) => nextSteps(t, today).map((s) => s.kind);
    expect(kinds(onTime)).not.toContain('save-monthly');
    expect(kinds({ ...japanDemo(), startDate: null })).not.toContain('save-monthly');
    expect(kinds(japanDemo(), '2027-05-01' as typeof JAPAN_TODAY)).not.toContain('save-monthly');
  });

  it('never returns more than four steps', () => {
    expect(nextSteps(japanDemo(), JAPAN_TODAY).length).toBeLessThanOrEqual(MAX_NEXT_STEPS);
  });
});
