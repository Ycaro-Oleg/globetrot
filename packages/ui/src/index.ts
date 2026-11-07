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
