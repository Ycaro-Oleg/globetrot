import { Button as AriaButton, type ButtonProps as AriaButtonProps } from 'react-aria-components';

export interface ButtonProps extends Omit<AriaButtonProps, 'className'> {
  variant?: 'primary' | 'thread' | 'ghost' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

/** Accessible button whose visible label is supplied by the calling locale. */
export function Button({ variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return <AriaButton {...props} className={`gt-button gt-button--${variant} gt-button--${size}`} />;
}
