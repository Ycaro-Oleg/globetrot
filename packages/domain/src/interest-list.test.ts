import { describe, expect, it } from 'vitest';
import {
  INTEREST_LIST,
  isInternalAddress,
  isReservedTestAddress,
  normalizeEmail,
} from './interest-list';

describe('normalizeEmail', () => {
  it('trims and lower-cases, and changes nothing else', () => {
    expect(normalizeEmail('  Ana.Maria+Trips@Mail.Example.COM ')).toBe(
      'ana.maria+trips@mail.example.com',
    );
  });
});

describe('isReservedTestAddress', () => {
  it.each([
    'someone@example.com',
    'someone@EXAMPLE.org',
    'someone@example.net',
    'someone@qa.test',
    'someone@anything.example',
    'someone@nowhere.invalid',
  ])('%s is reserved', (email) => {
    expect(isReservedTestAddress(email)).toBe(true);
  });

  it.each(['someone@example.com.br', 'someone@mail.testing', 'someone@sub.example.co'])(
    '%s is not reserved',
    (email) => {
      expect(isReservedTestAddress(email)).toBe(false);
    },
  );
});

describe('isInternalAddress', () => {
  it('is internal for an admin address, whatever its case', () => {
    expect(isInternalAddress(' Owner@Team.Dev ', ['owner@team.dev'])).toBe(true);
  });
  it('is internal for a reserved test domain', () => {
    expect(isInternalAddress('qa@globetrot.test', [])).toBe(true);
  });
  it('is not internal otherwise', () => {
    expect(isInternalAddress('visitor@mail.dev', ['owner@team.dev'])).toBe(false);
  });
});

describe('INTEREST_LIST', () => {
  it('keeps the retention the ADR states', () => {
    expect(INTEREST_LIST.pendingDays).toBe(7);
    expect(INTEREST_LIST.confirmHours).toBe(48);
    expect(INTEREST_LIST.confirmEmailsPerDay).toBe(3);
  });
});
