import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ savePip: vi.fn() }));

import { ProfileView } from './profile-view';

const VISAS = [
  { countryCode: 'JP', city: 'Tokyo', stampedAt: '2026-11-08T10:00:00.000Z' },
  { countryCode: 'PT', city: 'Lisbon', stampedAt: '2025-05-02T10:00:00.000Z' },
  { countryCode: 'ES', city: 'Madrid', stampedAt: '2025-05-09T10:00:00.000Z' },
];

function render(locale: SupportedLocale, props: Partial<Parameters<typeof ProfileView>[0]> = {}) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <ProfileView
        name="Ana"
        homeCity="São Paulo"
        look={{ hat: 'cap', outfit: 'aloha', bag: 'trolley', bagColor: 'cyan' }}
        pipName="Pipoca"
        tripCount={2}
        visas={VISAS}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('profile (%s)', (locale) => {
  const copy = catalogs[locale].profilePage;

  it('shows the person, their numbers and Pip with its name (the wardrobe is off for now)', () => {
    const html = render(locale);
    const plain = text(html);
    expect(plain).toContain('Ana');
    expect(plain).toContain(copy.myPip);
    expect(html).toContain('value="Pipoca"');
    expect(plain).toContain(copy.myPipGlobe);
    expect(html).not.toContain('id="pip-tab-outfit"');
    // Nothing changed yet, so saving is off.
    expect(html).toContain('disabled=""');
  });

  it('groups the visas by year, newest first, and names every stamp for screen readers', () => {
    const plain = text(render(locale));
    expect(plain.indexOf('2026')).toBeLessThan(plain.indexOf('2025'));
    expect(plain).toContain('Tokyo');
    expect(plain).toContain('Lisbon');
    expect(plain).toContain('Madrid');
  });

  it('shows the blank passport when there is no visa yet', () => {
    const plain = text(render(locale, { visas: [] }));
    expect(plain).toContain(copy.emptyTitle);
  });
});
