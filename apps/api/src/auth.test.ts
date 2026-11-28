import { describe, expect, it } from 'vitest';
import { errorCode } from './auth';

describe('errorCode', () => {
  it.each(['ECONNREFUSED', 'EAUTH', 'ETIMEDOUT', 'UNKNOWN', 'E_421'])(
    'keeps the code %s',
    (code) => {
      expect(errorCode(Object.assign(new Error('x'), { code }))).toBe(code);
    },
  );

  it.each([
    'rejected for ana@example.com',
    'econnrefused',
    'https://app.example.test/verify?token=abc',
    'A'.repeat(33),
    '',
  ])('turns a code that is free text into "unknown error" (%s)', (code) => {
    expect(errorCode(Object.assign(new Error('x'), { code }))).toBe('unknown error');
  });

  it('answers "unknown error" without a code, or for something that is not an error', () => {
    expect(errorCode(new Error('to ana@example.com'))).toBe('unknown error');
    expect(errorCode(Object.assign(new Error('x'), { code: 421 }))).toBe('unknown error');
    expect(errorCode(null)).toBe('unknown error');
    expect(errorCode('ECONNREFUSED')).toBe('unknown error');
  });
});
