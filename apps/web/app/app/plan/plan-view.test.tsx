import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BillingView } from '../../../lib/billing';

vi.mock('./actions', () => ({ startCheckout: vi.fn(), openPortal: vi.fn() }));

import { PlanBanner } from '../_components/plan-banner';
import { PlanView } from './plan-view';

const trial: BillingView = {
  access: 'trial',
  readOnly: false,
  trialEndsAt: '2026-11-08T12:00:00.000Z',
  trialDaysLeft: 5,
  plan: null,
  interval: null,
  status: null,
  renewsAt: null,
  maxActiveTrips: 10,
  activeTrips: 2,
  credits: {
    monthly: 15,
    monthlyLeft: 12,
    topUpLeft: 0,
    total: 12,
    periodEnd: '2026-11-08T12:00:00.000Z',
    dailyCap: 40,
  },
};
const expired: BillingView = { ...trial, access: 'expired', readOnly: true, trialDaysLeft: 0 };
const voyager: BillingView = {
  ...trial,
  access: 'voyager',
  plan: 'voyager',
  interval: 'month',
  status: 'active',
  renewsAt: '2026-12-05T00:00:00.000Z',
  maxActiveTrips: null,
  credits: { ...trial.credits, monthly: 400, monthlyLeft: 390, total: 390 },
};

const wrap = (locale: SupportedLocale, node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('plan page (%s)', (locale) => {
  const copy = catalogs[locale].planPage;
  const plans = catalogs[locale].plans;

  it('shows the trial, the credits meter and both plans with a way to choose each', () => {
    const html = wrap(locale, <PlanView billing={trial} />);
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="12"');
    expect(text(html)).toContain(plans.explorer.name);
    expect(text(html)).toContain(plans.voyager.name);
    expect(html.match(/class="[^"]*cta[^"]*"/g)).toHaveLength(2);
    expect(html).toMatch(locale === 'en' ? /\$4\.99/ : /US\$\s?4,99/);
    expect(html).not.toMatch(/planPage\.|plans\./);
  });

  it('says the account is read-only and the trips are safe once the trial is over', () => {
    const shown = text(wrap(locale, <PlanView billing={expired} />));
    expect(shown).toContain(copy.expiredTitle);
  });

  it('marks the current plan and offers to manage the payment', () => {
    const shown = text(wrap(locale, <PlanView billing={voyager} />));
    expect(shown).toContain(copy.current);
    expect(shown).toContain(copy.manage);
  });

  it('says when the plan cannot be read', () => {
    expect(wrap(locale, <PlanView billing={null} />)).toContain('role="alert"');
  });
});

describe.each(SUPPORTED_LOCALES)('free-week line (%s)', (locale) => {
  const copy = catalogs[locale].shell.plan;

  it('counts the days left in the trial, says read-only after it, and is quiet on a plan', () => {
    expect(wrap(locale, <PlanBanner billing={trial} />)).toContain('href="/app/plan"');
    expect(text(wrap(locale, <PlanBanner billing={expired} />))).toContain(copy.expiredCta);
    expect(wrap(locale, <PlanBanner billing={voyager} />)).toBe('');
    expect(wrap(locale, <PlanBanner billing={null} />)).toBe('');
  });
});

describe.each(SUPPORTED_LOCALES)('back from checkout (%s)', (locale) => {
  it('thanks the person while Stripe confirms the payment', () => {
    const copy = catalogs[locale].planPage;
    expect(wrap(locale, <PlanView billing={trial} paid="plan" />)).toContain(
      copy.thanksPlan.slice(0, 12),
    );
    expect(wrap(locale, <PlanView billing={trial} paid="top-up" />)).toContain(
      copy.thanksTopUp.slice(0, 12),
    );
  });
});
