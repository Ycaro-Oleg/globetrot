import { describe, expect, it } from 'vitest';
import { MILES_MAX_BALANCE, MILES_PROGRAMS, MILES_VALUES, milesTotal, milesValue } from './miles';

describe('the value of miles (ADR-0030)', () => {
  it('reads a balance as a range in reais per thousand miles, with a whole-real middle', () => {
    const value = milesValue('smiles', 60_000);
    expect(value.low).toEqual({ amountMinor: 96_000n, currency: 'BRL' });
    expect(value.high).toEqual({ amountMinor: 132_000n, currency: 'BRL' });
    expect(value.middle).toEqual({ amountMinor: 114_000n, currency: 'BRL' });
  });

  it('never goes negative or past the most a balance can hold, and drops fractions of a mile', () => {
    expect(milesValue('azul', -5).high.amountMinor).toBe(0n);
    expect(milesValue('azul', 1.9).high.amountMinor).toBe(milesValue('azul', 1).high.amountMinor);
    expect(milesValue('livelo', MILES_MAX_BALANCE * 10).high).toEqual(
      milesValue('livelo', MILES_MAX_BALANCE).high,
    );
  });

  it('adds several programmes, and every programme has a sensible range', () => {
    const total = milesTotal([
      { program: 'smiles', balance: 10_000 },
      { program: 'latam-pass', balance: 10_000 },
    ]);
    expect(total.low.amountMinor).toBe(16_000n + 23_000n);
    for (const program of MILES_PROGRAMS) {
      const [low, high] = MILES_VALUES[program].brlPerThousand;
      expect(low).toBeGreaterThan(0);
      expect(high).toBeGreaterThanOrEqual(low);
    }
    expect(milesTotal([]).middle.amountMinor).toBe(0n);
  });
});

describe('miles in the trip’s currency', () => {
  it('reads reais in another currency through the reference rates, and nothing without a rate', async () => {
    const { brlIn } = await import('./miles');
    const { money } = await import('./money/money');
    const value = money(57_651n, 'BRL');
    expect(brlIn(value, 'BRL')).toBe(value);
    expect(brlIn(value, 'USD')).toEqual({ amountMinor: 10_000n, currency: 'USD' });
    expect(brlIn(value, 'EUR')?.currency).toBe('EUR');
    expect(brlIn(value, 'THB')).toBeNull();
  });
});
