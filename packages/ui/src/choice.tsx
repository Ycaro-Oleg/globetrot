'use client';

import type { ReactNode } from 'react';
import {
  Checkbox as AriaCheckbox,
  Switch as AriaSwitch,
  type CheckboxProps as AriaCheckboxProps,
  type SwitchProps as AriaSwitchProps,
} from 'react-aria-components';

export interface CheckboxProps extends Omit<AriaCheckboxProps, 'children' | 'className'> {
  children: ReactNode;
}

export interface SwitchProps extends Omit<AriaSwitchProps, 'children' | 'className'> {
  children: ReactNode;
}

/** Checkbox with a visible, caller-localized label. */
export function Checkbox({ children, ...props }: CheckboxProps) {
  return (
    <AriaCheckbox {...props} className="gt-choice gt-checkbox">
      <span className="gt-choice__mark" aria-hidden="true" />
      <span>{children}</span>
    </AriaCheckbox>
  );
}

/** Switch with a visible, caller-localized label. */
export function Switch({ children, ...props }: SwitchProps) {
  return (
    <AriaSwitch {...props} className="gt-choice gt-switch">
      <span className="gt-choice__mark" aria-hidden="true" />
      <span>{children}</span>
    </AriaSwitch>
  );
}
