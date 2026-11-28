import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InterestListForm } from './interest-list-form';

function render(locale: SupportedLocale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

const visible = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('the interest list form in %s', (locale) => {
  const copy = catalogs[locale].interestList;
  const html = render(
    locale,
    <InterestListForm source="landing" locale={locale === 'pt-BR' ? 'pt-BR' : 'en'} />,
  );

  it('says what the emails are, with a visible email label, the consent box and the Privacy link', () => {
    const text = visible(html);
    for (const expected of [copy.title, copy.promise, copy.email, copy.consent, copy.submit]) {
      expect(text).toContain(expected);
    }
    expect(html).toContain('<label');
    expect(html).toMatch(/type="email"/);
    expect(html).toMatch(/href="\/privacy"/);
  });

  it('starts with the consent box unticked', () => {
    const box = /<input[^>]*type="checkbox"[^>]*>/.exec(html)?.[0] ?? '';
    expect(box).not.toBe('');
    expect(box).not.toMatch(/checked/);
  });

  it('keeps the promise in one key, as the owner approved it', () => {
    expect(copy.promise).toMatch(
      locale === 'pt-BR' ? /no máximo 2 emails por mês/ : /at most 2 emails a month/,
    );
  });
});
