import { exchangeRate, type ExchangeRate } from '../money/exchange-rate';

/**
 * Reference rates for showing a suggested plan's estimate in another currency: the European Central Bank's
 * reference rates for one day (through the Frankfurter service), recorded with their source and date as every
 * conversion must be (docs/architecture/money.md). They only change how an estimate reads; a trip's own costs
 * keep the rates the person types.
 */
const AS_OF = new Date('2026-11-26T16:00:00Z');
const SOURCE = 'European Central Bank reference rates (via Frankfurter)';

const PER_USD: Readonly<Record<string, string>> = {
  EUR: '0.91116',
  GBP: '0.76314',
  BRL: '5.7651',
  CAD: '1.423',
  AUD: '1.5071',
  MXN: '19.6711',
  JPY: '159.26',
  CHF: '0.83399',
  INR: '92.45',
};

export const SUGGEST_RATE_CURRENCIES = ['USD', ...Object.keys(PER_USD)] as const;

/** The reference rate from USD to `currency`, or null for USD itself or a currency without one. */
export function suggestReferenceRate(currency: string): ExchangeRate | null {
  const rate = PER_USD[currency];
  if (!rate) return null;
  return exchangeRate({
    id: `ecb-${AS_OF.toISOString().slice(0, 10)}-USD-${currency}`,
    base: 'USD',
    quote: currency,
    rate,
    source: SOURCE,
    asOf: AS_OF,
  });
}
