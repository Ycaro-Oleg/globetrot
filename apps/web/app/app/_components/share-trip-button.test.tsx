import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./trip-actions', () => ({ ensureTripShare: vi.fn() }));

import { ShareTripButton } from './share-trip-button';

describe.each(SUPPORTED_LOCALES)('share-my-trip button (%s)', (locale) => {
  it('is one labelled button with a live status for the result', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
        <ShareTripButton tripId="t1" title="Portugal" />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(catalogs[locale].tripHub.share.shareMoment);
    expect(html).toContain('role="status"');
  });
});
