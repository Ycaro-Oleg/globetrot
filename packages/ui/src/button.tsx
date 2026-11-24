'use client';

import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  /** `cta` is the one coral call to action of a view (design handoff v2); `thread` is the red one. */
  variant?: 'primary' | 'cta' | 'thread' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/** Accessible button whose visible label is supplied by the calling locale. */
export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <AriaButton {...props} className={`gt-button gt-button--${variant} gt-button--${size}`} />;
}
