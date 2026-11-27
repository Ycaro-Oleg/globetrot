import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../plan/actions', () => ({ startCheckout: vi.fn() }));

import { PassCard } from './pass-card';

describe.each(SUPPORTED_LOCALES)('trip pass card (%s)', (locale) => {
  const copy = catalogs[locale].tripPass;
  const render = (props: Partial<Parameters<typeof PassCard>[0]> = {}) =>
    renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
        <PassCard tripId="t1" currency="USD" validUntil={null} justPaid={false} {...props} />
      </NextIntlClientProvider>,
    );

  it('offers the pass at its price in the person’s price currency', () => {
    expect(render()).toContain(copy.title);
    expect(render()).toMatch(locale === 'en' ? /\$9\.99/ : /US\$\s?9,99/);
    expect(render({ currency: 'BRL' })).toMatch(/R\$\s?49[,.]00/);
    expect(render()).toMatch(locale === 'en' ? /50 Pip credits/ : /50 créditos do Pip/);
  });

  it('offers a free pass first when the person earned one', () => {
    const html = render({ freePasses: 1 });
    expect(html).toContain(copy.useFree.split('(')[0]!.trim());
    expect(html.match(/<button/g)).toHaveLength(2);
  });

  it('says until when a bought pass holds, with no button', () => {
    const html = render({ validUntil: '2027-04-06T00:00:00.000Z' });
    expect(html).toMatch(/2027/);
    expect(html).not.toContain('<button');
  });
});
