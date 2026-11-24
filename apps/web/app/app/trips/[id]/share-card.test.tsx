import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../_components/trip-actions', () => ({ setTripShare: vi.fn() }));

import { ShareCard } from './share-card';

const render = (locale: SupportedLocale, slug: string | null) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <ShareCard tripId="t1" title="Portugal" initial={{ slug, showAmounts: false }} />
    </NextIntlClientProvider>,
  );

describe.each(SUPPORTED_LOCALES)('share card (%s)', (locale) => {
  const copy = catalogs[locale].tripHub.share;

  it('offers to create a link when there is none', () => {
    const html = render(locale, null);
    expect(html).toContain(copy.start);
    expect(html).not.toContain(copy.stop);
  });

  it('offers copy, the amounts choice and stopping once the link is on', () => {
    const html = render(locale, 'abcdefghijklmnopqrstuv');
    expect(html).toContain(copy.copy);
    expect(html).toContain(copy.showAmounts);
    expect(html).toContain(copy.stop);
    expect(html).toContain('type="checkbox"');
  });
});
