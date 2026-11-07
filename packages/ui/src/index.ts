/**
 * @globetrot/ui: Web component library (React Aria + Tailwind) documented in Storybook.
 * Scaffold only (issue #10). Real content arrives in later issues; see docs/architecture/overview.md.
 */
export const PACKAGE_NAME = '@globetrot/ui' as const;

export { Button } from './button';
export type { ButtonProps } from './button';

export { TextField } from './text-field';
export type { TextFieldProps } from './text-field';

export { Checkbox, Switch } from './choice';
export type { CheckboxProps, SwitchProps } from './choice';

export { StatusMark, STATUS_MARKS } from './status-mark';
export type { StatusMarkKind, StatusMarkProps } from './status-mark';

export { SelectField } from './select-field';
export type { SelectFieldProps, SelectOption } from './select-field';

export { Range } from './range';
export type { RangeProps } from './range';

export { Banner } from './banner';
export type { BannerProps } from './banner';
export { Modal } from './modal';
export type { ModalProps } from './modal';
