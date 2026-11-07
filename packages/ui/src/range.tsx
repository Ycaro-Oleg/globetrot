import type { ReactNode } from 'react';
import {
  Label,
  Slider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  type SliderProps,
} from 'react-aria-components';

export interface RangeProps extends Omit<
  SliderProps<number>,
  'children' | 'className' | 'orientation'
> {
  label: ReactNode;
}

/** A single-value, keyboard-accessible slider with a caller-localized label. */
export function Range({ label, ...props }: RangeProps) {
  return (
    <Slider {...props} orientation="horizontal" className="gt-range">
      <div className="gt-range__header">
        <Label className="gt-field__label">{label}</Label>
        <SliderOutput />
      </div>
      <SliderTrack className="gt-range__track">
        <SliderThumb className="gt-range__thumb" />
      </SliderTrack>
    </Slider>
  );
}
