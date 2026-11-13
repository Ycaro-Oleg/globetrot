import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./actions', () => ({ finishOnboarding: vi.fn() }));

import { OnboardingFlow } from './onboarding-flow';

function render(locale: SupportedLocale) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      <OnboardingFlow currency="USD" homeCity="" pipOptIn={false} />
    </NextIntlClientProvider>,
  );
}

describe.each(SUPPORTED_LOCALES)('onboarding (%s)', (locale) => {
  const copy = catalogs[locale].onboarding;

  it('opens on the welcome: the promises, one coral call to action and the trip summary', () => {
    const html = render(locale);
    expect(html).toContain(copy.welcomeTitle);
    for (const key of ['promise1', 'promise2', 'promise3'] as const) {
      expect(html).toContain(copy[key]);
    }
    expect(html.match(/class="[^"]*cta[^"]*"/g)).toHaveLength(1);
    expect(html).toContain(copy.start);
    expect(html).toContain(`aria-label="${copy.summary}"`);
    expect(html).not.toMatch(/onboarding\.[a-zA-Z]+/);
  });

  it('has a heading the flow moves focus to on every step', () => {
    expect(render(locale)).toMatch(/<h1 tabindex="-1">/);
  });
});
