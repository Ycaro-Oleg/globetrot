import type { ReactNode } from 'react';

export const STATUS_MARKS = ['estimate', 'confirmed', 'paid', 'unknown'] as const;
export type StatusMarkKind = (typeof STATUS_MARKS)[number];

export interface StatusMarkProps {
  status: StatusMarkKind;
  children: ReactNode;
}

const SYMBOLS: Record<StatusMarkKind, string> = {
  estimate: '≈',
  confirmed: '✓',
  paid: '●',
  unknown: '?',
};

/** Status glyph and caller-localized label; color is never the only cue. */
export function StatusMark({ status, children }: StatusMarkProps) {
  return (
    <span className={`gt-status gt-status--${status}`}>
      <span aria-hidden="true">{SYMBOLS[status]}</span> {children}
    </span>
  );
}
