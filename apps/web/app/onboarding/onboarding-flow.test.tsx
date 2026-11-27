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

  it('opens straight on where to go, with where you leave from as optional, and the trip summary', () => {
    const html = render(locale);
    expect(html).toContain(copy.destTitle);
    expect(html).toContain(copy.originLabelOptional);
    expect(html).toContain(copy.stepLabel.replace('{step}', '1').replace('{total}', '3'));
    expect(html.match(/class="[^"]*cta[^"]*"/g)).toHaveLength(1);
    expect(html).toContain(copy.continue);
    expect(html).toContain(`aria-label="${copy.summary}"`);
    expect(html).not.toMatch(/onboarding\.[a-zA-Z]+/);
  });

  it('has a heading the flow moves focus to on every step', () => {
    expect(render(locale)).toMatch(/<h1 tabindex="-1">/);
  });
});
