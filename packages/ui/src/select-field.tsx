'use client';

import type { ReactNode } from 'react';
import {
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Text,
  type SelectProps as AriaSelectProps,
} from 'react-aria-components';

export interface SelectOption {
  id: string;
  label: string;
}
export interface SelectFieldProps extends Omit<
  AriaSelectProps<SelectOption>,
  'children' | 'className'
> {
  label: ReactNode;
  options: readonly SelectOption[];
  description?: ReactNode;
  errorMessage?: ReactNode;
}

/** A labeled single-select. Labels, options and placeholder are supplied by the caller. */
export function SelectField({
  label,
  options,
  description,
  errorMessage,
  ...props
}: SelectFieldProps) {
  return (
    <Select {...props} className="gt-field">
      <Label className="gt-field__label">{label}</Label>
      <Button className="gt-select__trigger">
        <SelectValue />
        <span aria-hidden="true">▾</span>
      </Button>
      {description && (
        <Text slot="description" className="gt-field__description">
          {description}
        </Text>
      )}
      {errorMessage && <FieldError className="gt-field__error">{errorMessage}</FieldError>}
      <Popover className="gt-select__popover">
        <ListBox className="gt-select__list">
          {options.map((option) => (
            <ListBoxItem
              id={option.id}
              key={option.id}
              textValue={option.label}
              className="gt-select__option"
            >
              {option.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
