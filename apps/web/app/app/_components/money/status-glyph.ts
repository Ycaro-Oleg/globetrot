import type { ExpenseStatus } from '@globetrot/domain';

/** Status glyphs (business rules: a status always shows a glyph and a word, never colour alone). */
export const STATUS_GLYPH: Record<ExpenseStatus, string> = {
  paid: '●',
  confirmed: '✓',
  estimate: '≈',
  unknown: '?',
};
