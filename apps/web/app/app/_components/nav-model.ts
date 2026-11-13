/**
 * The shell's navigation (design handoff v2, "Shell & Navigation", option 1a): one sticky bar on every screen
 * with two levels. The trip's own tools sit in a segmented control next to the trip switcher; the places that
 * belong to the whole account sit on the right. On a phone the trip tools become a second row and the account
 * places a bottom bar.
 */

/** Keys of the `shell.nav` catalog entries. */
export type NavKey =
  'board' | 'days' | 'budget' | 'lists' | 'passport' | 'trips' | 'trip' | 'settings';

export interface NavItem {
  readonly key: NavKey;
  readonly href: string;
}

const item = (key: NavKey, href: string): NavItem => ({ key, href });

/** The current trip's tools, in the order people plan: map, days, budget, lists. */
export const TRIP_TABS: readonly NavItem[] = [
  item('board', '/app/board'),
  item('days', '/app/days'),
  item('budget', '/app/budget'),
  item('lists', '/app/lists'),
];

/** The account's own places, on the right of the bar (from 720 px). */
export const GLOBAL_LINKS: readonly NavItem[] = [
  item('trips', '/app/trips'),
  item('passport', '/app/passport'),
];

/** The phone's bottom bar: the trip (its tools are the second row), then the account's places. */
export const BOTTOM_ITEMS: readonly NavItem[] = [
  item('trip', '/app/board'),
  item('trips', '/app/trips'),
  item('passport', '/app/passport'),
  item('settings', '/settings'),
];

export const SETTINGS_HREF = '/settings';
export const PIP_HREF = '/app/pip';

function isWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Whether a page belongs to the current trip's tools (so the second row and the "Trip" item apply). */
export function isTripPage(pathname: string): boolean {
  return TRIP_TABS.some((tab) => isWithin(pathname, tab.href));
}

/**
 * Whether `navItem` is the current page for `pathname`: its own page and anything beneath it (a look-alike such
 * as `/app/boardroom` does not count). "Trip" stands for all four trip tools.
 */
export function isCurrent(navItem: NavItem, pathname: string): boolean {
  if (navItem.key === 'trip') return isTripPage(pathname);
  return isWithin(pathname, navItem.href);
}

/** Up to two letters for the trip's disc: the initials of its first two words ("Japan, spring" → "JS"). */
export function tripCode(title: string): string {
  const words = title
    .split(/[\s,.;:/·-]+/u)
    .map((word) => word.trim())
    .filter(Boolean);
  const letters = words.slice(0, 2).map((word) => Array.from(word)[0]!.toLocaleUpperCase());
  if (letters.length === 1) {
    const second = Array.from(words[0]!)[1];
    if (second) letters.push(second.toLocaleUpperCase());
  }
  return letters.join('') || '•';
}
