import { describe, expect, it } from 'vitest';
import {
  BOTTOM_ITEMS,
  GLOBAL_LINKS,
  isCurrent,
  isTripPage,
  isWorkspacePage,
  MENU_HREFS,
  TRIP_TABS,
  tripCode,
  type NavItem,
} from './nav-model';

function find(items: readonly NavItem[], key: string): NavItem {
  const found = items.find((entry) => entry.key === key);
  if (!found) throw new Error(`no ${key}`);
  return found;
}

describe('navigation model', () => {
  it('has the trip tools: its document first, then the full map, the budget and the lists', () => {
    expect(TRIP_TABS.map((entry) => entry.key)).toEqual(['overview', 'board', 'budget', 'lists']);
    expect(TRIP_TABS[0]?.href).toBe('/app/trip');
  });

  it('keeps the full map out of the workspace and the document, budget and lists in it', () => {
    for (const path of ['/app/trip', '/app/budget', '/app/lists', '/app/budget/anything']) {
      expect(isWorkspacePage(path)).toBe(true);
    }
    for (const path of ['/app/board', '/app/trips', '/app/tripping', '/app/discover']) {
      expect(isWorkspacePage(path)).toBe(false);
    }
  });

  it('puts every destination somewhere on the phone', () => {
    const reachable = new Set([
      ...[...TRIP_TABS, ...BOTTOM_ITEMS].map((entry) => entry.href),
      ...MENU_HREFS,
    ]);
    for (const entry of GLOBAL_LINKS) expect(reachable.has(entry.href)).toBe(true);
  });

  it('keeps hrefs unique within each group', () => {
    for (const group of [TRIP_TABS, GLOBAL_LINKS]) {
      const hrefs = group.map((entry) => entry.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });

  it('marks a section for its page and what is under it, not for a look-alike', () => {
    const board = find(TRIP_TABS, 'board');
    expect(isCurrent(board, '/app/board')).toBe(true);
    expect(isCurrent(board, '/app/board/anything')).toBe(true);
    expect(isCurrent(board, '/app/boardroom')).toBe(false);
    expect(isCurrent(board, '/app/trip')).toBe(false);
  });

  it('marks "Trip" on every trip tool and nowhere else', () => {
    const trip = find(BOTTOM_ITEMS, 'trip');
    for (const path of ['/app/trip', '/app/board', '/app/budget', '/app/lists']) {
      expect(isCurrent(trip, path)).toBe(true);
      expect(isTripPage(path)).toBe(true);
    }
    for (const path of ['/app/passport', '/app/trips', '/settings']) {
      expect(isCurrent(trip, path)).toBe(false);
      expect(isTripPage(path)).toBe(false);
    }
  });
});

describe('tripCode', () => {
  it('takes the initials of the first two words', () => {
    expect(tripCode('Japan, spring')).toBe('JS');
    expect(tripCode('Río de la Plata')).toBe('RD');
    expect(tripCode('lisboa')).toBe('LI');
    expect(tripCode('   ')).toBe('•');
  });
});
