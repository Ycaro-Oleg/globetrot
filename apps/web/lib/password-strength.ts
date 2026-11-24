import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@globetrot/domain';

/**
 * 0 is "too short" (the server would refuse it); 1 to 4 are the segments of the meter:
 * weak, okay, good, strong.
 */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export const STRENGTH_KEYS = ['tooShort', 'weak', 'okay', 'good', 'strong'] as const;
export type StrengthKey = (typeof STRENGTH_KEYS)[number];

// A short list of what people actually type first. The server does not check it: this only keeps the meter from
// calling "password123" good. A real breached-password check would need a data source and is not part of #57.
const COMMON = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwertyui',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'letmein1',
  'welcome1',
  'admin123',
  'abc12345',
  'abcd1234',
  'senha123',
  'minhasenha',
  '11111111',
  '00000000',
  'globetrot',
]);

const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiopasdfghjklzxcvbnm'];

function isSequential(value: string): boolean {
  const lower = value.toLowerCase();
  return SEQUENCES.some((sequence) => {
    const backwards = [...sequence].reverse().join('');
    return sequence.includes(lower) || backwards.includes(lower);
  });
}

const classesOf = (value: string) =>
  [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(value)).length;

/** Four or more words of three or more letters: a passphrase, which is long and easy to remember. */
const looksLikePassphrase = (value: string) =>
  value.split(/[\s\-_.]+/).filter((word) => /^\p{L}{3,}$/u.test(word)).length >= 4;

/**
 * A rough, local, explainable estimate for the strength meter. It rewards length and variety, recognizes
 * passphrases, and caps the obvious (a common password, a keyboard or alphabet run, one repeated character) at
 * "weak". It is guidance, not a guarantee: it never decides whether a password is accepted. That is the
 * server's length rule (`PASSWORD_MIN_LENGTH` to `PASSWORD_MAX_LENGTH`).
 */
export function passwordStrength(password: string): StrengthLevel {
  if (password.length < PASSWORD_MIN_LENGTH) return 0;

  const lower = password.toLowerCase();
  if (COMMON.has(lower) || isSequential(password) || new Set(password).size < 4) return 1;

  // A long passphrase is as good as it gets, whatever characters it uses.
  if (password.length >= 16 && looksLikePassphrase(password)) return 4;

  let level = 1;
  if (password.length >= 12) level += 1;
  if (classesOf(password) >= 3) level += 1;
  if (password.length >= 16) level += 1;
  // Short passwords stay below "strong" however mixed they are.
  if (password.length < 12) level = Math.min(level, 2);
  return Math.min(level, 4) as StrengthLevel;
}

export const strengthKey = (level: StrengthLevel): StrengthKey => STRENGTH_KEYS[level];

/** The length rule the server enforces, as the screens explain it. */
export function lengthProblem(password: string): 'tooShort' | 'tooLong' | null {
  if (password.length < PASSWORD_MIN_LENGTH) return 'tooShort';
  if (password.length > PASSWORD_MAX_LENGTH) return 'tooLong';
  return null;
}
