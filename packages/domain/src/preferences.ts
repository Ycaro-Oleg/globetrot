/** How distances and similar quantities are shown. Never inferred from the language or the country. */
export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const DEFAULT_UNIT_SYSTEM: UnitSystem = 'metric';

/**
 * What a person chose for the look of the app. `system` follows the operating system's light or dark setting.
 * The two designed themes are `day` and `red-eye` (the tokens' `data-theme` values).
 */
export const THEME_CHOICES = ['day', 'red-eye', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];
export type Theme = Exclude<ThemeChoice, 'system'>;
export const DEFAULT_THEME_CHOICE: ThemeChoice = 'system';

/** `reduced` turns animation down. `full` still yields to the operating system's reduced-motion setting. */
export const MOTION_CHOICES = ['full', 'reduced'] as const;
export type MotionChoice = (typeof MOTION_CHOICES)[number];
export const DEFAULT_MOTION_CHOICE: MotionChoice = 'full';

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  THEME_CHOICES.some((choice) => choice === value);
export const isMotionChoice = (value: unknown): value is MotionChoice =>
  MOTION_CHOICES.some((choice) => choice === value);

/** The theme to draw: an explicit choice wins, and `system` follows the OS (light means `day`). */
export function resolveTheme(choice: ThemeChoice, systemPrefersDark: boolean): Theme {
  if (choice === 'system') return systemPrefersDark ? 'red-eye' : 'day';
  return choice;
}

/** The motion to use: the OS asking for reduced motion always wins over `full`. */
export function resolveMotion(choice: MotionChoice, systemPrefersReduced: boolean): MotionChoice {
  return systemPrefersReduced ? 'reduced' : choice;
}
