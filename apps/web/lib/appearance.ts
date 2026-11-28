import {
  DEFAULT_MOTION_CHOICE,
  DEFAULT_THEME_CHOICE,
  isMotionChoice,
  isThemeChoice,
  resolveTheme,
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

/** The parts of the page that `applyTheme` touches, so it can run against a stand-in in tests. */
export interface ThemeTarget {
  readonly documentElement: { setAttribute(name: string, value: string): void };
  readonly prefersDark: boolean;
}

/**
 * Draws a theme choice on the page now, without a reload. The head script switches `data-theme` behind React's
 * back for `system`, so React's own value can be stale (it renders `system` as `day`): a change of choice that
 * keeps React's value the same would otherwise leave the page in the old theme. Setting the choice as well keeps
 * the head script following the operating system only while the choice is `system`.
 */
export function applyTheme(choice: ThemeChoice, target?: ThemeTarget): void {
  const page = target ?? {
    documentElement: document.documentElement,
    prefersDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  };
  page.documentElement.setAttribute('data-theme-choice', choice);
  page.documentElement.setAttribute('data-theme', resolveTheme(choice, page.prefersDark));
}

/** Draws a motion choice on the page now (the CSS reads `data-motion`; the OS asking for less always wins). */
export function applyMotion(choice: MotionChoice, root?: ThemeTarget['documentElement']): void {
  (root ?? document.documentElement).setAttribute('data-motion', choice);
}

/**
 * Picking a look in Settings: it shows at once, is saved right away, and goes back to the previous choice when the
 * save fails (an error, a refusal or no network), so the control and the page never disagree with the account.
 * Answers whether the choice was kept.
 */
export async function switchAppearance<T>(
  next: T,
  previous: T,
  apply: (choice: T) => void,
  save: (choice: T) => Promise<boolean>,
): Promise<boolean> {
  apply(next);
  let kept = false;
  try {
    kept = await save(next);
  } catch {
    kept = false;
  }
  if (!kept) apply(previous);
  return kept;
}
