import { suggestPlan } from '@globetrot/domain';
import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SuggestResult } from './landing-suggest';

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

function render(locale: SupportedLocale, code: string, monthly: number) {
  const plan = suggestPlan({
    destination: 'japan',
    likes: ['adrenaline'],
    days: 12,
    comfort: 'budget',
  })!;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <SuggestResult
        plan={plan}
        code={code}
        monthly={monthly}
        signupHref="/signup"
        onRestart={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

describe.each(SUPPORTED_LOCALES)('the finished plan (%s)', (locale) => {
  const copy = catalogs[locale].landing.suggest;
  const why = catalogs[locale].suggest.why;

  it('answers first: the range per person, the month, the research date, then the itinerary', () => {
    const plain = text(render(locale, 'USD', 300));
    expect(plain).toMatch(locale === 'en' ? /per person/ : /por pessoa/);
    expect(plain).not.toContain(copy.answerNone);
    expect(plain).toContain(why['tokyo-ebisu-drift']);
    expect(plain).toContain(why['kyoto-hozugawa']);
    expect(plain).toContain(copy.offbeat);
    expect(plain).toContain(copy.restart);
  });

  it('shows another currency with the reference rate it used', () => {
    const plain = text(render(locale, 'BRL', 1500));
    expect(plain).toContain('R$');
    expect(plain).toContain(copy.rateNote.split('{date}')[0]!.trim());
  });

  it('asks for a monthly amount before giving a month', () => {
    expect(text(render(locale, 'USD', 0))).toContain(copy.answerNone);
  });
});
