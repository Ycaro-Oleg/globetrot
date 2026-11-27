import { describe, expect, it } from 'vitest';
import { answerOf, type SavingsAnswerInput } from './answer';

const base: SavingsAnswerInput = {
  status: 'saving',
  monthly: { amount: '300.00' },
  readyMonth: '2027-03',
  departure: '2027-04-03',
  onTime: true,
  monthlyNeeded: { amount: '380.00' },
};

describe('the savings answer', () => {
  it('says there is nothing to save for before any cost', () => {
    expect(answerOf({ ...base, status: 'no-costs' })).toEqual({ kind: 'noCosts' });
  });

  it('says everything is saved', () => {
    expect(answerOf({ ...base, status: 'fully-saved' })).toEqual({ kind: 'fullySaved' });
  });

  it('is a yes, with the month, when the monthly amount gets there in time', () => {
    expect(answerOf(base)).toEqual({ kind: 'yes', month: '2027-03' });
  });

  it('is a yes with no departure date to be late for', () => {
    expect(answerOf({ ...base, departure: null, onTime: null })).toEqual({
      kind: 'yes',
      month: '2027-03',
    });
  });

  it('is "almost" when the goal is reached after leaving', () => {
    expect(answerOf({ ...base, readyMonth: '2027-06', onTime: false })).toEqual({
      kind: 'almost',
      month: '2027-06',
      departure: '2027-04-03',
    });
  });

  it('asks for a monthly amount when there is none, offering what would be ready by departure', () => {
    expect(
      answerOf({ ...base, monthly: { amount: '0.00' }, readyMonth: null, onTime: false }),
    ).toEqual({
      kind: 'setMonthly',
      needed: '380.00',
      departure: '2027-04-03',
    });
    expect(
      answerOf({
        ...base,
        monthly: { amount: '0.00' },
        readyMonth: null,
        departure: null,
        monthlyNeeded: null,
        onTime: null,
      }),
    ).toEqual({
      kind: 'setMonthly',
      needed: null,
      departure: null,
    });
  });
});
