import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { isReferralCode } from '../../../lib/referral';
import { ReferralCard } from './referral-card';

describe.each(SUPPORTED_LOCALES)('referral card (%s)', (locale) => {
  it('offers the link to copy and says what it earned', () => {
    const copy = catalogs[locale].referral;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
        <ReferralCard referral={{ code: 'ABCD1234', joined: 2, passCredits: 1 }} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain(copy.title);
    expect(html).toContain(`aria-label="${copy.linkLabel}"`);
    expect(html).toMatch(
      locale === 'en'
        ? /2 friends joined · 1 free pass to use/
        : /2 amigos entraram · 1 passe grátis para usar/,
    );
  });
});

it('accepts only plain referral codes', () => {
  expect(isReferralCode('ABCD1234')).toBe(true);
  expect(isReferralCode('abc')).toBe(false);
  expect(isReferralCode('ABCD1234<script>')).toBe(false);
  expect(isReferralCode(null)).toBe(false);
});
