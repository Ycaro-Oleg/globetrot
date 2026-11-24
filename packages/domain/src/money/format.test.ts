import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';
import { fromDecimal, money } from './money';

/** ICU uses (narrow) no-break spaces (U+00A0, U+202F); normalize them so expectations stay readable. */
const NO_BREAK_SPACES = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f)}]`, 'g');
const fmt = (...args: Parameters<typeof formatMoney>) =>
  formatMoney(...args).replace(NO_BREAK_SPACES, ' ');

describe('formatMoney', () => {
  it('keeps locale and currency independent', () => {
    expect(fmt(fromDecimal('1250', 'USD'), 'en-US')).toBe('$1,250.00');
    expect(fmt(fromDecimal('1250', 'USD'), 'pt-BR')).toBe('US$ 1.250,00');
    expect(fmt(fromDecimal('1250', 'BRL'), 'pt-BR')).toBe('R$ 1.250,00');
    expect(fmt(fromDecimal('1250', 'BRL'), 'en-US')).toBe('R$1,250.00');
    expect(fmt(fromDecimal('1250', 'EUR'), 'de-DE')).toBe('1.250,00 €');
  });

  it('uses each currency’s ISO precision', () => {
    expect(fmt(fromDecimal('1250', 'JPY'), 'en-US')).toBe('¥1,250');
    expect(fmt(fromDecimal('1250', 'JPY'), 'ja-JP')).toMatch(/^[¥￥]1,250$/);
    expect(fmt(fromDecimal('1.250', 'KWD'), 'en-US')).toBe('KWD 1.250');
  });

  it('formats negatives', () => {
    expect(fmt(fromDecimal('-12.5', 'USD'), 'en-US')).toBe('-$12.50');
  });

  it('supports other currency displays', () => {
    expect(fmt(fromDecimal('5', 'USD'), 'en-US', { display: 'code' })).toBe('USD 5.00');
    expect(fmt(fromDecimal('5', 'BRL'), 'en-US', { display: 'name' })).toBe('5.00 Brazilian reals');
    expect(fmt(fromDecimal('5', 'BRL'), 'pt-BR', { display: 'name' })).toBe(
      '5,00 Reais brasileiros',
    );
  });

  it('rounds whole-unit estimates half-even', () => {
    expect(fmt(fromDecimal('1249.50', 'USD'), 'en-US', { precision: 'whole' })).toBe('$1,250');
    expect(fmt(fromDecimal('1250.50', 'USD'), 'en-US', { precision: 'whole' })).toBe('$1,250');
    expect(fmt(fromDecimal('1251.50', 'USD'), 'en-US', { precision: 'whole' })).toBe('$1,252');
  });

  it('formats huge amounts exactly (no floating point)', () => {
    expect(fmt(money(10n ** 18n + 1n, 'USD'), 'en-US')).toBe('$10,000,000,000,000,000.01');
  });
});
