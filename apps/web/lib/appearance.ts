import {
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  isMotionChoice,
  isThemeChoice,
  type MotionChoice,
  type ThemeChoice,
} from '@globetrot/domain';

/** Where an anonymous visitor's choice is kept (a signed-in person's choice is stored with their settings). */
export const THEME_COOKIE = 'globetrot_theme';
export const MOTION_COOKIE = 'globetrot_motion';

export interface Appearance {
  readonly theme: ThemeChoice;
  readonly motion: MotionChoice;
}

/**
 * The look of a request. A signed-in person's stored choice wins; the cookies are what an anonymous visitor (or a
 * signed-in one whose settings cannot be read) has; anything unknown falls back to the defaults.
 */
export function chooseAppearance(
  cookies: { readonly theme?: string | undefined; readonly motion?: string | undefined },
  stored: { readonly theme: string; readonly motion: string } | null,
): Appearance {
  const theme = [stored?.theme, cookies.theme].find(isThemeChoice);
  const motion = [stored?.motion, cookies.motion].find(isMotionChoice);
  return {
    theme: theme ?? DEFAULT_THEME_CHOICE,
    motion: motion ?? DEFAULT_MOTION_CHOICE,
  };
}

/**
 * Runs in the page's head, before anything is painted: for the `system` choice it picks `day` or `red-eye` from the
 * operating system's setting and follows it when that changes. An explicit choice is already rendered by the
 * server, so this does nothing for it. Kept tiny and dependency-free on purpose.
 */
export const THEME_SCRIPT = `(function(){var d=document.documentElement,q=matchMedia('(prefers-color-scheme: dark)');function a(){if(d.getAttribute('data-theme-choice')==='system')d.setAttribute('data-theme',q.matches?'red-eye':'day')}a();if(q.addEventListener)q.addEventListener('change',a)})()`;
