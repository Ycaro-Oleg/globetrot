import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { lengthProblem, passwordStrength, strengthKey, STRENGTH_KEYS } from './password-strength';

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['abc', 0],
    ['Ab1!xyz', 0], // 7 characters: below the server's minimum, however mixed
  ])('%j is too short (%i)', (password, level) => {
    expect(passwordStrength(password)).toBe(level);
  });

  it.each([
    'password',
    'Password123',
    '12345678',
    '87654321',
    'abcdefgh',
    'qwertyuiop',
    'aaaaaaaaaaaa',
    'abababababab',
    'senha123',
    'iloveyou',
  ])('caps the obvious %j at weak', (password) => {
    expect(passwordStrength(password)).toBe(1);
  });

  it.each([
    ['xk3 pbq7', 2], // 8 characters, 3 classes at most: okay at best
    ['Tr0ub4dor&3', 2], // 11 characters mixed, but short
  ])('keeps %j below good (level %i)', (password, level) => {
    expect(passwordStrength(password)).toBeLessThanOrEqual(level);
    expect(passwordStrength(password)).toBeGreaterThanOrEqual(1);
  });

  it('rates a passphrase strong without symbols or digits', () => {
    expect(passwordStrength('correct horse battery staple')).toBe(4);
    expect(passwordStrength('cavalo bateria grampo certo')).toBe(4);
  });

  it('rates long mixed passwords good or strong', () => {
    expect(passwordStrength('Xk3!pQ7#mZ9$')).toBeGreaterThanOrEqual(3);
    expect(passwordStrength('v8N$2fL!qT7@wR5%')).toBe(4);
  });

  it('grows with length for the same kind of characters', () => {
    const levels = ['kJh3dFg7', 'kJh3dFg7Lm2p', 'kJh3dFg7Lm2pQw9z'].map(passwordStrength);
    expect(levels).toEqual([...levels].sort());
    expect(levels[0]).toBeLessThan(levels[2]!);
  });

  it('always answers 0 to 4, and 0 exactly when the server would refuse it as too short', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (password) => {
        const level = passwordStrength(password);
        expect([0, 1, 2, 3, 4]).toContain(level);
        expect(level === 0).toBe(password.length < 8);
      }),
      { numRuns: 500 },
    );
  });

  it('maps each level to one label key', () => {
    expect(STRENGTH_KEYS).toEqual(['tooShort', 'weak', 'okay', 'good', 'strong']);
    expect([0, 1, 2, 3, 4].map((level) => strengthKey(level as 0 | 1 | 2 | 3 | 4))).toEqual([
      ...STRENGTH_KEYS,
    ]);
  });
});

describe('lengthProblem', () => {
  it('follows the server limits exactly', () => {
    expect(lengthProblem('x'.repeat(7))).toBe('tooShort');
    expect(lengthProblem('x'.repeat(8))).toBeNull();
    expect(lengthProblem('x'.repeat(128))).toBeNull();
    expect(lengthProblem('x'.repeat(129))).toBe('tooLong');
  });
});
