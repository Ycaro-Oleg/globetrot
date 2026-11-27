/**
 * The shell's navigation, in three areas: the trip (its workspace: a sidebar with the trip's sections, the trip's
 * document and the map on the right; elsewhere its tools in a segmented control next to the trip switcher),
 * Discover (ready plans, and the community when it is on) and you (the avatar menu: profile, passport, plan,
 * trips, settings). Pip is a floating button that opens on the screen's topic. On a phone the trip tools become a
 * second row (a jump bar inside the workspace) and the areas a bottom bar.
 */

/** Keys of the `shell.nav` catalog entries. */
export type NavKey =
  | 'overview'
  | 'board'
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

/** The trip's document: overview, places and the itinerary day by day, with the map beside it. */
export const TRIP_HOME = '/app/trip';

/** The current trip's tools: its document, the full map, the budget and the checklists. */
export const TRIP_TABS: readonly NavItem[] = [
  item('overview', TRIP_HOME),
  item('board', '/app/board'),
  item('budget', '/app/budget'),
  item('lists', '/app/lists'),
];

/**
 * Pages inside the trip workspace (sidebar, document, map on the right). Their own sidebar (or the jump bar on a
 * phone) is the trip's navigation, so the bar's trip tabs step aside there. The full map is not one of them.
 */
export const WORKSPACE_HREFS: readonly string[] = [TRIP_HOME, '/app/budget', '/app/lists'];

/** The other area on the right of the bar (from 720 px); "you" is the avatar menu beside it. */
export const GLOBAL_LINKS: readonly NavItem[] = [item('discover', '/app/discover')];

/**
 * The phone's bottom bar: the three areas. The trip list, the passport and the plan are one tap away in the trip
 * switcher and the avatar menu.
 */
export const BOTTOM_ITEMS: readonly NavItem[] = [
  item('trip', TRIP_HOME),
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

/** Whether a page sits in the trip workspace, which brings its own navigation. */
export function isWorkspacePage(pathname: string): boolean {
  return WORKSPACE_HREFS.some((href) => isWithin(pathname, href));
}

/**
 * Whether `navItem` is the current page for `pathname`: its own page and anything beneath it (a look-alike such
 * as `/app/boardroom` does not count). "Trip" stands for all the trip's tools.
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
