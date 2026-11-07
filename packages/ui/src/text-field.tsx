import type { ReactNode } from 'react';
import {
  TextField as AriaTextField,
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  type TextFieldProps as AriaTextFieldProps,
} from 'react-aria-components';

export interface TextFieldProps extends Omit<AriaTextFieldProps, 'children' | 'className'> {
  label: ReactNode;
  description?: ReactNode;
  errorMessage?: ReactNode;
  multiline?: boolean;
  placeholder?: string;
}

/** A labeled input or textarea; callers supply all locale-specific copy. */
export function TextField({
  label,
  description,
  errorMessage,
  multiline = false,
  placeholder,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} className="gt-field">
      <Label className="gt-field__label">{label}</Label>
      {multiline ? (
        <TextArea
          className="gt-field__control"
          {...(placeholder === undefined ? {} : { placeholder })}
        />
      ) : (
        <Input
          className="gt-field__control"
          {...(placeholder === undefined ? {} : { placeholder })}
        />
      )}
      {description && (
        <Text slot="description" className="gt-field__description">
          {description}
        </Text>
      )}
      {errorMessage && <FieldError className="gt-field__error">{errorMessage}</FieldError>}
    </AriaTextField>
  );
}
