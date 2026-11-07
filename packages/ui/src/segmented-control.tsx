import type { ReactNode } from 'react';
import { Label, Radio, RadioGroup, type RadioGroupProps } from 'react-aria-components';

export interface SegmentOption {
  id: string;
  label: string;
  isDisabled?: boolean;
}
export interface SegmentedControlProps extends Omit<
  RadioGroupProps,
  'children' | 'className' | 'orientation'
> {
  label: ReactNode;
  options: readonly SegmentOption[];
}

/** A single-choice segmented control with radio-group keyboard semantics. */
export function SegmentedControl({ label, options, ...props }: SegmentedControlProps) {
  return (
    <RadioGroup {...props} orientation="horizontal" className="gt-segmented">
      <Label className="gt-field__label">{label}</Label>
      <div className="gt-segmented__items">
        {options.map((option) => (
          <Radio
            key={option.id}
            value={option.id}
            isDisabled={option.isDisabled ?? false}
            className="gt-segmented__item"
          >
            {option.label}
          </Radio>
        ))}
      </div>
    </RadioGroup>
  );
}
