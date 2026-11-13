import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The server action only matters on submit; keep `next/headers` out of the render test.
vi.mock('../actions', () => ({ savePreferences: vi.fn() }));

import { countryOptions, currencyOptions, timeZoneOptions } from './options';
import { SettingsView, type SettingsViewProps } from './settings-view';

const VALUES: SettingsViewProps['values'] = {
  locale: 'pt-BR',
  currency: 'USD',
  homeCountry: null,
  nationality: 'PT',
  timeZone: 'America/Sao_Paulo',
  units: 'metric',
  theme: 'system',
  motion: 'full',
  homeCity: null,
  pipOptIn: false,
  pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
  pipName: null,
};

function render(locale: SupportedLocale, status?: string, values = VALUES): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <SettingsView
        values={values}
        currencies={currencyOptions(locale)}
        countries={countryOptions(locale)}
        timeZones={timeZoneOptions(locale, values.timeZone)}
        status={status}
      />
    </NextIntlClientProvider>,
  );
}

/** What a reader sees: markup and inline scripts removed. */
const visibleText = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<select[\s\S]*?<\/select>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replace(/\s+/g, ' ')
    .trim();

describe('settings view', () => {
  it.each(SUPPORTED_LOCALES)('shows every label from the %s catalog', (locale) => {
    const copy = catalogs[locale].settings;
    const text = visibleText(render(locale));
    for (const key of [
      'title',
      'description',
      'language',
      'languageHelp',
      'currency',
      'currencyHelp',
      'homeCountry',
      'nationality',
      'timeZone',
      'timeZoneHelp',
      'units',
      'save',
    ] as const) {
      expect(text, key).toContain(copy[key]);
    }
  });

  it('submits one named field for each independent setting', () => {
    const html = render('en');
    for (const name of ['locale', 'currency', 'homeCountry', 'nationality', 'timeZone', 'units']) {
      expect(html, name).toContain(`name="${name}"`);
    }
    expect(html).toContain('type="submit"');
  });

  it('shows the stored values, and "Not set" for the ones that are empty', () => {
    const html = render('pt-BR');
    const text = visibleText(html);
    expect(text).toContain(catalogs['pt-BR'].settings.notSet); // home country is empty
    expect(text).toContain('Portugal'); // nationality, named in Portuguese
    expect(text).toContain('America/Sao Paulo');
    expect(text).toContain('USD');
  });

  it('keeps the currency when the language is Portuguese: nothing is derived from the language', () => {
    expect(visibleText(render('pt-BR'))).toContain('USD');
    expect(visibleText(render('pt-BR'))).not.toContain('BRL ·');
    const english = render('en', undefined, { ...VALUES, locale: 'en', currency: 'BRL' });
    expect(visibleText(english)).toContain('BRL');
  });

  it('announces a save politely and a failure as an alert, naming the fields', () => {
    const saved = render('en', 'saved');
    expect(saved).toContain('role="status"');
    expect(visibleText(saved)).toContain(catalogs.en.settings.saved);

    const failed = render('en', 'error:currency,timeZone');
    expect(failed).toContain('role="alert"');
    expect(visibleText(failed)).toContain('currency,timeZone');
    expect(visibleText(render('en'))).not.toContain(catalogs.en.settings.saved);
  });

  it('puts the language names in the same form in both locales, so people can find their own', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const html = render(locale);
      expect(html).toContain('English');
      expect(html).toContain('Português (Brasil)');
    }
  });

  it.each(SUPPORTED_LOCALES)(
    'shows the theme and motion controls with their labels (%s)',
    (locale) => {
      const copy = catalogs[locale].settings;
      const html = render(locale, undefined, { ...VALUES, theme: 'red-eye', motion: 'reduced' });
      const text = visibleText(html);
      for (const key of [
        'theme',
        'themeDay',
        'themeRedEye',
        'themeSystem',
        'motion',
        'motionFull',
        'motionReduced',
        'appearanceHelp',
      ] as const) {
        expect(text, key).toContain(copy[key]);
      }
      // Radios named for the form, with the stored choice checked.
      const radios = (name: string) =>
        [...html.matchAll(/<input[^>]*>/g)]
          .map((m) => m[0])
          .filter((tag) => tag.includes(`name="${name}"`));
      const value = (tag: string) => /value="([^"]+)"/.exec(tag)?.[1];
      expect(radios('theme').map(value)).toEqual(['day', 'red-eye', 'system']);
      // The stored choice is the selected segment (React Aria marks it on its label).
      const selected = [
        ...html.matchAll(/<label[^>]*data-selected="true"[^>]*>([\s\S]*?)<\/label>/g),
      ].map((m) => m[1]?.replace(/<[^>]+>/g, '').trim());
      expect(selected).toEqual([copy.themeRedEye, copy.motionReduced]);
    },
  );
});
