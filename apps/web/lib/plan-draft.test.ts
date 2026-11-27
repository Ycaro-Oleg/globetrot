import { describe, expect, it } from 'vitest';
import { readDraft } from './plan-draft';

const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe('readDraft', () => {
  it('reads the landing page numbers', () => {
    expect(readDraft(cookie({ cost: '3000', saved: '500', monthly: '300' }))).toEqual({
      cost: '3000',
      saved: '500',
      monthly: '300',
      currency: null,
      suggestion: null,
    });
  });
  it('keeps the plan built on the landing, only when every part of it checks out', () => {
    const plan = { destination: 'japan', likes: ['food', 'food'], days: 12, comfort: 'budget' };
    const base = { cost: '3000', saved: '0', monthly: '300', currency: 'USD' };
    expect(readDraft(cookie({ ...base, suggestion: plan }))?.suggestion).toEqual({
      ...plan,
      likes: ['food'],
    });
    for (const broken of [
      { ...plan, destination: 'mars' },
      { ...plan, likes: ['sleeping'] },
      { ...plan, days: 90 },
      { ...plan, days: 2.5 },
      { ...plan, comfort: 'luxury' },
      'japan',
    ]) {
      expect(readDraft(cookie({ ...base, suggestion: broken }))?.suggestion).toBeNull();
    }
  });
  it('keeps the currency picked on the landing page, only when it is a real code', () => {
    const draft = { cost: '15000', saved: '2500', monthly: '1500' };
    expect(readDraft(cookie({ ...draft, currency: 'BRL' }))?.currency).toBe('BRL');
    expect(readDraft(cookie({ ...draft, currency: 'XXX' }))?.currency).toBeNull();
    expect(readDraft(cookie({ ...draft, currency: '<b>' }))?.currency).toBeNull();
  });
  it('ignores anything that is not three plain amounts', () => {
    expect(readDraft(undefined)).toBeNull();
    expect(readDraft('not json')).toBeNull();
    expect(readDraft(cookie({ cost: '3000', saved: '500' }))).toBeNull();
    expect(readDraft(cookie({ cost: '<script>', saved: '1', monthly: '1' }))).toBeNull();
    expect(readDraft(cookie({ cost: 3000, saved: '1', monthly: '1' }))).toBeNull();
  });
});
