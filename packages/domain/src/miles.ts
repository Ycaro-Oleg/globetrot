/**
 * Miles as part of saving for a trip (ADR-0029): what a balance in a Brazilian loyalty programme is typically
 * worth, as a range in reais per thousand miles with the date and the sources it was researched from. Always an
 * estimate: what miles buy depends on the route, the date and the programme's own prices.
 */
import { convert } from './money/exchange-rate';
import { money, type Money } from './money/money';
import { suggestReferenceRate } from './suggest/rates';

export const MILES_PROGRAMS = ['smiles', 'latam-pass', 'azul', 'livelo', 'esfera'] as const;
export type MilesProgram = (typeof MILES_PROGRAMS)[number];

export interface MilesValue {
  /** Reais per 1 000 miles: [low, high]. */
  readonly brlPerThousand: readonly [low: number, high: number];
}

/** When the ranges were researched, and where (shown with every estimate). */
export const MILES_RESEARCHED_ON = '2026-11-26';
export const MILES_SOURCES = [
  'MilhasBot (Sep 2026)',
  'Viagem Black (Apr 2026)',
  'Cartão e Milhas',
] as const;

export const MILES_VALUES: Readonly<Record<MilesProgram, MilesValue>> = {
  smiles: { brlPerThousand: [16, 22] },
  'latam-pass': { brlPerThousand: [23, 28] },
  azul: { brlPerThousand: [13, 17] },
  livelo: { brlPerThousand: [23, 30] },
  esfera: { brlPerThousand: [22, 33] },
};

/** The most miles one balance can hold here: well above any real balance, so a typo cannot make a fortune. */
export const MILES_MAX_BALANCE = 50_000_000;

export interface MilesEstimate {
  readonly low: Money;
  readonly high: Money;
  /** The middle of the range, rounded down to whole reais: what the savings answer uses. */
  readonly middle: Money;
}

/** What `balance` miles of `program` are typically worth, in reais. */
export function milesValue(program: MilesProgram, balance: number): MilesEstimate {
  const miles = BigInt(Math.max(0, Math.min(MILES_MAX_BALANCE, Math.floor(balance))));
  const [low, high] = MILES_VALUES[program].brlPerThousand;
  // Centavos: miles × R$ per thousand × 100 ÷ 1000.
  const at = (perThousand: number) => (miles * BigInt(perThousand) * 100n) / 1000n;
  const lowMinor = at(low);
  const highMinor = at(high);
  const middle = ((lowMinor + highMinor) / 2n / 100n) * 100n;
  return {
    low: money(lowMinor, 'BRL'),
    high: money(highMinor, 'BRL'),
    middle: money(middle, 'BRL'),
  };
}

/** The total of several balances, adding the ranges. */
export function milesTotal(
  balances: readonly { readonly program: MilesProgram; readonly balance: number }[],
): MilesEstimate {
  return balances.reduce<MilesEstimate>(
    (sum, { program, balance }) => {
      const value = milesValue(program, balance);
      return {
        low: money(sum.low.amountMinor + value.low.amountMinor, 'BRL'),
        high: money(sum.high.amountMinor + value.high.amountMinor, 'BRL'),
        middle: money(sum.middle.amountMinor + value.middle.amountMinor, 'BRL'),
      };
    },
    { low: money(0n, 'BRL'), high: money(0n, 'BRL'), middle: money(0n, 'BRL') },
  );
}

/**
 * A reais amount in another currency at the recorded reference rates (through US dollars), or null for a
 * currency without one: the trip's own currency is what its answer is in.
 */
export function brlIn(value: Money, currency: string): Money | null {
  if (currency === 'BRL') return value;
  const brl = suggestReferenceRate('BRL');
  if (!brl) return null;
  const usd = convert(value, brl).converted;
  if (currency === 'USD') return usd;
  const rate = suggestReferenceRate(currency);
  return rate ? convert(usd, rate).converted : null;
}
