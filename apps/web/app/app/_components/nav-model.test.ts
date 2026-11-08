import { describe, expect, it } from 'vitest';
import { isCurrent, MORE_ITEMS, RAIL_ITEMS, TAB_ITEMS, type NavItem } from './nav-model';

function find(items: readonly NavItem[], key: string): NavItem {
  const found = items.find((entry) => entry.key === key);
  if (!found) throw new Error(`no ${key}`);
  return found;
}

describe('navigation model', () => {
  it('has five phone tabs, with More last', () => {
    expect(TAB_ITEMS.map((entry) => entry.key)).toEqual([
      'board',
      'days',
      'budget',
      'lists',
      'more',
    ]);
  });

  it('puts every destination somewhere on the phone', () => {
    const reachable = new Set([...TAB_ITEMS, ...MORE_ITEMS].map((entry) => entry.href));
    for (const entry of RAIL_ITEMS) expect(reachable.has(entry.href)).toBe(true);
  });

  it('keeps hrefs unique and under /app', () => {
    const hrefs = RAIL_ITEMS.map((entry) => entry.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) expect(href.startsWith('/app')).toBe(true);
  });

  it('marks Home only on /app itself', () => {
    const home = find(RAIL_ITEMS, 'home');
    expect(isCurrent(home, '/app')).toBe(true);
    expect(isCurrent(home, '/app/board')).toBe(false);
  });

  it('marks a section for its page and what is under it, not for a look-alike', () => {
    const board = find(RAIL_ITEMS, 'board');
    expect(isCurrent(board, '/app/board')).toBe(true);
    expect(isCurrent(board, '/app/board/anything')).toBe(true);
    expect(isCurrent(board, '/app/boardroom')).toBe(false);
    expect(isCurrent(board, '/app/days')).toBe(false);
  });

  it('marks More for the pages it holds', () => {
    const more = find(TAB_ITEMS, 'more');
    for (const path of ['/app/more', '/app/trips', '/app/passport', '/app/pip']) {
      expect(isCurrent(more, path)).toBe(true);
    }
    expect(isCurrent(more, '/app/board')).toBe(false);
    expect(isCurrent(more, '/app')).toBe(false);
  });
});
