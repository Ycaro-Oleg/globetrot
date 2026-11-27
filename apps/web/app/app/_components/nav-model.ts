/**
 * The shell's navigation, in three areas: the trip (its tools in a segmented control next to the trip switcher),
 * Discover (ready plans, and the community when it is on) and you (the avatar menu: profile, passport, plan,
 * trips, settings). Pip is a floating button that opens on the screen's topic. On a phone the trip tools become a
 * second row and the areas a bottom bar.
 */

/** Keys of the `shell.nav` catalog entries. */
export type NavKey =
  | 'board'
  | 'days'
  | 'budget'
  | 'lists'
  | 'passport'
  | 'trips'
  | 'trip'
  | 'settings'
  | 'profile'
  | 'community'
  | 'discover';

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

/** The other area on the right of the bar (from 720 px); "you" is the avatar menu beside it. */
export const GLOBAL_LINKS: readonly NavItem[] = [item('discover', '/app/discover')];

/**
 * The phone's bottom bar: the three areas. The trip list, the passport and the plan are one tap away in the trip
 * switcher and the avatar menu.
 */
export const BOTTOM_ITEMS: readonly NavItem[] = [
  item('trip', '/app/board'),
  item('discover', '/app/discover'),
  item('profile', '/app/profile'),
];

/** Places a phone reaches through the trip switcher or the avatar menu rather than the bottom bar. */
export const MENU_HREFS: readonly string[] = ['/app/trips'];

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
