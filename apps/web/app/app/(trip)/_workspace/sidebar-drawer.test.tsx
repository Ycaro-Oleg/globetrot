import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  clampWidth,
  readDrawer,
  SIDEBAR_DEFAULT,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  SidebarDrawer,
  widthForKey,
} from './sidebar-drawer';

function render(locale: SupportedLocale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

describe('sidebar drawer width', () => {
  it('stays between the limits', () => {
    expect(clampWidth(100)).toBe(SIDEBAR_MIN);
    expect(clampWidth(9000)).toBe(SIDEBAR_MAX);
    expect(clampWidth(250.6)).toBe(251);
    expect(clampWidth('wide')).toBe(SIDEBAR_DEFAULT);
    expect(clampWidth(Number.NaN)).toBe(SIDEBAR_DEFAULT);
  });

  it('moves with the arrow keys and jumps to the limits with Home and End', () => {
    expect(widthForKey(232, 'ArrowRight', false)).toBe(248);
    expect(widthForKey(232, 'ArrowLeft', false)).toBe(216);
    expect(widthForKey(232, 'ArrowRight', true)).toBe(280);
    expect(widthForKey(SIDEBAR_MAX, 'ArrowRight', true)).toBe(SIDEBAR_MAX);
    expect(widthForKey(232, 'Home', false)).toBe(SIDEBAR_MIN);
    expect(widthForKey(232, 'End', false)).toBe(SIDEBAR_MAX);
    expect(widthForKey(232, 'Enter', false)).toBeNull();
  });

  it('reads what was saved, and the default when it is missing or broken', () => {
    expect(readDrawer(null)).toEqual({ width: SIDEBAR_DEFAULT, open: true });
    expect(readDrawer('{"width":300,"open":false}')).toEqual({ width: 300, open: false });
    expect(readDrawer('{"width":5000}')).toEqual({ width: SIDEBAR_MAX, open: true });
    expect(readDrawer('not json')).toEqual({ width: SIDEBAR_DEFAULT, open: true });
  });
});

describe.each(SUPPORTED_LOCALES)('sidebar drawer (%s)', (locale) => {
  const copy = catalogs[locale].workspace;

  it('open: a toggle that says it hides the sections, and a keyboard-operable resize edge', () => {
    const html = render(
      locale,
      <SidebarDrawer
        state={{ width: 260, open: true }}
        onChange={() => undefined}
        footer={<a href="/app/board">map</a>}
      >
        <nav>sections</nav>
      </SidebarDrawer>,
    );
    // An icon button: its name and tooltip carry the label.
    expect(html).toMatch(
      new RegExp(
        `<button[^>]*aria-expanded="true"[^>]*aria-label="${copy.sidebarHide}"[^>]*title="${copy.sidebarHide}"`,
      ),
    );
    // The footer comes after the resize edge, so the keyboard reaches it last.
    expect(html.indexOf('role="separator"')).toBeLessThan(html.indexOf('href="/app/board"'));
    expect(html).toMatch(/role="separator"/);
    expect(html).toMatch(/tabindex="0"/);
    expect(html).toContain(`aria-label="${copy.sidebarResize}"`);
    expect(html).toContain('aria-valuenow="260"');
    expect(html).toContain(`aria-valuemin="${SIDEBAR_MIN}"`);
    expect(html).toContain(`aria-valuemax="${SIDEBAR_MAX}"`);
    expect(html).toContain('sections');
  });

  it('folded: the sections are hidden, no resize edge, the button says it shows them', () => {
    const html = render(
      locale,
      <SidebarDrawer
        state={{ width: 260, open: false }}
        onChange={() => undefined}
        footer={<a href="/app/board">map</a>}
      >
        <nav>sections</nav>
      </SidebarDrawer>,
    );
    expect(html).toMatch(/<button[^>]*aria-expanded="false"/);
    expect(html).toContain(`aria-label="${copy.sidebarShow}"`);
    expect(html).not.toContain('href="/app/board"');
    expect(html).toMatch(/<div[^>]*hidden=""[^>]*>/);
    expect(html).not.toContain('role="separator"');
  });
});
