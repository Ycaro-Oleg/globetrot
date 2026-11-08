import {
  Compass,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Menu,
  Plane,
  Settings,
  Sparkles,
  Wallet,
  CalendarDays,
  House,
  Stamp,
} from 'lucide-react';

/** Keys of the `shell.nav` catalog entries. */
export type NavKey = 'home' | 'trips' | 'board' | 'days' | 'budget' | 'lists' | 'passport' | 'more';

export interface NavItem {
  readonly key: NavKey;
  readonly href: string;
  readonly Icon: LucideIcon;
}

const item = (key: NavKey, href: string, Icon: LucideIcon): NavItem => ({ key, href, Icon });

/** The rail (desktop and tablet): everything the signed-in app has, in the order people use it. */
export const RAIL_ITEMS: readonly NavItem[] = [
  item('home', '/app', House),
  item('trips', '/app/trips', Plane),
  item('board', '/app/board', MapIcon),
  item('days', '/app/days', CalendarDays),
  item('budget', '/app/budget', Wallet),
  item('lists', '/app/lists', ListChecks),
  item('passport', '/app/passport', Stamp),
];

/** The phone tab bar: the five trip tools; the rest lives under More. */
export const TAB_ITEMS: readonly NavItem[] = [
  item('board', '/app/board', MapIcon),
  item('days', '/app/days', CalendarDays),
  item('budget', '/app/budget', Wallet),
  item('lists', '/app/lists', ListChecks),
  item('more', '/app/more', Menu),
];

/** What the More page lists: the destinations that are not in the tab bar. */
export const MORE_ITEMS: readonly NavItem[] = [
  item('home', '/app', House),
  item('trips', '/app/trips', Plane),
  item('passport', '/app/passport', Stamp),
];

export const SETTINGS_HREF = '/settings';
export const PIP_HREF = '/app/pip';

/** Icons shared by the shell's other parts. */
export const BRAND_ICON: LucideIcon = Compass;
export const PIP_ICON: LucideIcon = Sparkles;
export const SETTINGS_ICON: LucideIcon = Settings;

/** Paths that the More tab stands for: when one of them is open, More is the tab that is current. */
const MORE_PATHS: readonly string[] = ['/app/more', '/app/trips', '/app/passport', '/app/pip'];

function isWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Whether `item` is the current page for `pathname`. Home matches only itself (every other page is under
 * `/app`); the others match their own pages and anything beneath them (a trip's board, for example).
 */
export function isCurrent(navItem: NavItem, pathname: string): boolean {
  if (navItem.key === 'home') return pathname === '/app';
  if (navItem.key === 'more') return MORE_PATHS.some((path) => isWithin(pathname, path));
  return isWithin(pathname, navItem.href);
}
