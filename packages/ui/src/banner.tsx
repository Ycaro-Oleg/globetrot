import type { HTMLAttributes, ReactNode } from 'react';

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'className'> {
  tone?: 'info' | 'success' | 'error';
  children: ReactNode;
}

const SYMBOLS = { info: 'ℹ', success: '✓', error: '!' } as const;

/** Informational surface with a text label; callers choose whether to announce it. */
export function Banner({ tone = 'info', children, ...props }: BannerProps) {
  return (
    <div {...props} className={`gt-banner gt-banner--${tone}`}>
      <span aria-hidden="true">{SYMBOLS[tone]}</span>
      <div>{children}</div>
    </div>
  );
}
