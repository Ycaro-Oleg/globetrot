import { describe, expect, it } from 'vitest';
import { canonicalTimeZone, isTimeZone } from './time-zone';

describe('canonicalTimeZone', () => {
  it.each([
    ['America/Sao_Paulo', 'America/Sao_Paulo'],
    ['Europe/Lisbon', 'Europe/Lisbon'],
    ['Asia/Tokyo', 'Asia/Tokyo'],
    ['America/Argentina/Buenos_Aires', 'America/Argentina/Buenos_Aires'],
    ['UTC', 'UTC'],
  ])('accepts %s', (input, expected) => {
    expect(canonicalTimeZone(input)).toBe(expected);
  });

  it('fixes the case', () => {
    expect(canonicalTimeZone('america/sao_paulo')).toBe('America/Sao_Paulo');
    expect(canonicalTimeZone('EUROPE/LISBON')).toBe('Europe/Lisbon');
    expect(canonicalTimeZone('utc')).toBe('UTC');
  });

  it.each([
    'Mars/Olympus_Mons',
    'America/Nowhere',
    'Sao_Paulo',
    'GMT+3',
    '+01:00',
    '-0500',
    'America/',
    '/America/Sao_Paulo',
    'America//Sao_Paulo',
    ' America/Sao_Paulo',
    'America/Sao_Paulo ',
    '',
    'x'.repeat(65),
    'America/Sao_Paulo; DROP TABLE trip',
    null,
    undefined,
    7,
  ])('rejects %j', (value) => {
    expect(canonicalTimeZone(value)).toBeNull();
    expect(isTimeZone(value)).toBe(false);
  });
});
