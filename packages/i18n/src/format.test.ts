import { describe, expect, it } from 'vitest';
import type { MessageKey } from './catalog';
import { formatLocalDate, formatMessage, formatYearMonth, MissingMessageError } from './format';

const NO_BREAK_SPACES = new RegExp(`[${String.fromCharCode(0x00a0, 0x202f)}]`, 'g');
const plain = (s: string) => s.replace(NO_BREAK_SPACES, ' ');

describe('formatMessage: plurals', () => {
  it.each([
    [0, 'Every day has a plan', 'Todo dia tem um plano'],
    [1, '1 day has nothing planned yet', '1 dia ainda sem nada planejado'],
    [3, '3 days have nothing planned yet', '3 dias ainda sem nada planejado'],
  ])('planEmptyDays with %d', (count, en, pt) => {
    expect(formatMessage('en', 'nextSteps.planEmptyDays', { count })).toBe(en);
    expect(formatMessage('pt-BR', 'nextSteps.planEmptyDays', { count })).toBe(pt);
  });

  it.each([
    [0, 'day trip', 'bate-volta'],
    [1, '1 night', '1 noite'],
    [4, '4 nights', '4 noites'],
  ])('nights with %d', (count, en, pt) => {
    expect(formatMessage('en', 'trip.nights', { count })).toBe(en);
    expect(formatMessage('pt-BR', 'trip.nights', { count })).toBe(pt);
  });

  it('formats numbers with locale separators', () => {
    expect(formatMessage('en', 'milestones.progress', { earned: 4, total: 9 })).toBe(
      '4 of 9 stamps on this trip.',
    );
    expect(formatMessage('pt-BR', 'milestones.progress', { earned: 4, total: 9 })).toBe(
      '4 de 9 carimbos nesta viagem.',
    );
    expect(formatMessage('en', 'trip.nights', { count: 1200 })).toBe('1,200 nights');
    expect(formatMessage('pt-BR', 'trip.nights', { count: 1200 })).toBe('1.200 noites');
  });
});

describe('formatMessage: select, arguments and rich text', () => {
  it.each([
    ['private', 'Only you can see this trip', 'Só você vê esta viagem'],
    [
      'public',
      'Anyone with the link can see this trip',
      'Qualquer pessoa com o link vê esta viagem',
    ],
    ['shared-with-aliens', 'Visibility unknown', 'Visibilidade desconhecida'],
  ])('visibility = %s', (visibility, en, pt) => {
    expect(formatMessage('en', 'trip.visibility', { visibility })).toBe(en);
    expect(formatMessage('pt-BR', 'trip.visibility', { visibility })).toBe(pt);
  });

  it('interpolates arguments', () => {
    expect(formatMessage('pt-BR', 'nextSteps.findStay', { city: 'Osaka' })).toBe(
      'Encontre onde dormir em Osaka',
    );
  });

  it('renders rich-text tags as plain text outside React', () => {
    expect(formatMessage('en', 'savings.answerYes', { month: 'April 2027', amount: '$300' })).toBe(
      'Yes — by April 2027, if you put aside $300 a month.',
    );
    expect(
      formatMessage('pt-BR', 'savings.answerYes', { month: 'abril de 2027', amount: 'R$ 1.500' }),
    ).toBe('Sim — até abril de 2027, se você guardar R$ 1.500 por mês.');
  });

  it('reuses compiled messages', () => {
    expect(formatMessage('en', 'status.paid')).toBe('● paid');
    expect(formatMessage('en', 'status.paid')).toBe('● paid');
  });

  it('throws a typed error for unknown keys', () => {
    expect(() => formatMessage('en', 'nope.missing' as MessageKey)).toThrow(MissingMessageError);
  });
});

describe('dates', () => {
  it('formats calendar dates without time-zone drift', () => {
    expect(plain(formatLocalDate('2027-04-03', 'en'))).toBe('Apr 3, 2027');
    expect(plain(formatLocalDate('2027-04-03', 'pt-BR'))).toBe('3 de abr. de 2027');
    expect(
      formatLocalDate('2027-04-03', 'en', { weekday: 'short', day: 'numeric', month: 'long' }),
    ).toBe('Sat, April 3');
    expect(formatLocalDate('0099-12-31', 'en', { year: 'numeric' })).toBe('99');
  });

  it('formats a savings month', () => {
    expect(formatYearMonth('2027-04', 'en')).toBe('April 2027');
    expect(formatYearMonth('2027-04', 'pt-BR')).toBe('abril de 2027');
  });

  it('rejects malformed input', () => {
    expect(() => formatLocalDate('03/04/2027', 'en')).toThrow(RangeError);
    expect(() => formatYearMonth('2027-4', 'en')).toThrow(RangeError);
  });
});
