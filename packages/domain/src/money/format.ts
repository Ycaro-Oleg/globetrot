import { minorUnitExponent } from './currency';
import { toDecimalString, type Money } from './money';

export interface FormatMoneyOptions {
  /** How the currency is shown. Default `'symbol'` ("US$", "R$", "¥" depending on locale). */
  readonly display?: 'symbol' | 'narrowSymbol' | 'code' | 'name';
  /**
   * Fraction digits to show. Default: the currency's full ISO precision.
   * `'whole'` hides fractions (rounded half-even), for coarse estimates like "≈ $1,200".
   */
  readonly precision?: 'full' | 'whole';
}

/**
 * Formats money for a locale. The locale (user's language/region) and the currency (from the data)
 * are independent: a pt-BR user sees "US$ 1.250,00", an en-US user sees "R$1,250.00" (ADR-0004).
 * The exact decimal string is passed to Intl, so no floating-point rounding happens.
 */
export function formatMoney(
  value: Money,
  locale: string,
  options: FormatMoneyOptions = {},
): string {
  const digits = options.precision === 'whole' ? 0 : minorUnitExponent(value.currency);
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    currencyDisplay: options.display ?? 'symbol',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    roundingMode: 'halfEven',
  });
  return formatter.format(toDecimalString(value) as Intl.StringNumericLiteral);
}
