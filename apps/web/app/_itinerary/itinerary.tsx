import {
  convert,
  formatMoney,
  money,
  SUGGEST_MAX_DAYS,
  SUGGEST_RATE_CURRENCIES,
  SUGGESTED_DESTINATIONS,
  suggestPlan,
  suggestReferenceRate,
  toCurrencyCode,
  type Money,
  type SuggestedDestination,
} from '@globetrot/domain';
import { catalogs } from '@globetrot/i18n';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { siteOrigin } from '../../lib/site-url';
import { InterestListForm } from '../_interest-list/interest-list-form';
import { SITE_NAME } from '../site';
import styles from './itinerary.module.css';

export type ItineraryLanguage = 'en' | 'pt';
const LOCALE = { en: 'en', pt: 'pt-BR' } as const;
const BASE = { en: '/itineraries', pt: '/roteiros' } as const;
const CURRENCY_PARAM = { en: 'currency', pt: 'moeda' } as const;

export const itineraryPath = (destination: SuggestedDestination, language: ItineraryLanguage) =>
  `${BASE[language]}/${language === 'pt' ? destination.slugPt : destination.slug}`;

/** The reference plan: every stop at its usual nights, everything the person might like. */
export function referencePlan(destination: SuggestedDestination, comfort: 'budget' | 'comfort') {
  const nights = destination.stops.reduce((sum, stop) => sum + stop.nights, 0);
  return suggestPlan({
    destination: destination.id,
    likes: [],
    days: Math.min(SUGGEST_MAX_DAYS, nights + 1),
    comfort,
  })!;
}

/** The currency the visitor picked from the page's switch; US dollars until they pick. */
export function pickedCurrency(value: string | undefined): string {
  return value && (SUGGEST_RATE_CURRENCIES as readonly string[]).includes(value) ? value : 'USD';
}

export async function itineraryMetadata(
  destination: SuggestedDestination,
  language: ItineraryLanguage,
): Promise<Metadata> {
  const t = await getTranslations({ locale: LOCALE[language], namespace: 'itinerary' });
  const plan = referencePlan(destination, 'budget');
  const name = language === 'pt' ? destination.namePt : destination.name;
  const title = t('metaTitle', { destination: name, days: plan.days });
  const description = t('metaDescription', {
    destination: name,
    stops: plan.stops.length,
    days: plan.days,
  });
  const origin = await siteOrigin();
  return {
    title: `${title} · ${SITE_NAME}`,
    description,
    alternates: {
      canonical: new URL(itineraryPath(destination, language), origin).toString(),
      languages: {
        en: new URL(itineraryPath(destination, 'en'), origin).toString(),
        'pt-BR': new URL(itineraryPath(destination, 'pt'), origin).toString(),
      },
    },
    openGraph: { title, description, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/**
 * A public, indexable itinerary built from the curated catalog (ADR-0028): the route with nights, the experiences
 * and why they are worth it, the typical cost per person with its research date, what to set aside each month, and
 * the way to make it one's own. Every amount is a typical range, never a quote.
 */
export async function Itinerary({
  destination,
  language,
  currency,
}: {
  destination: SuggestedDestination;
  language: ItineraryLanguage;
  currency: string;
}) {
  const locale = LOCALE[language];
  const t = await getTranslations({ locale, namespace: 'itinerary' });
  const pt = language === 'pt';
  const plan = referencePlan(destination, 'budget');
  const comfort = referencePlan(destination, 'comfort');
  const rate = currency === 'USD' ? null : suggestReferenceRate(toCurrencyCode(currency));
  const inCurrency = (usd: Money) => (rate ? convert(usd, rate).converted : usd);
  const fmt = (usd: Money) => formatMoney(inCurrency(usd), locale, { precision: 'whole' });
  const usd = (whole: number) => money(BigInt(whole) * 100n, 'USD');
  const range = (low: number, high: number) => `${fmt(usd(low))}–${fmt(usd(high))}`;
  const monthly = (months: number) =>
    fmt(money(plan.estimate.middle.amountMinor / BigInt(months), 'USD'));
  const name = pt ? destination.namePt : destination.name;
  const researched = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${plan.researchedOn}T12:00:00Z`),
  );
  const others = SUGGESTED_DESTINATIONS.filter((other) => other.id !== destination.id);

  return (
    <main className={styles.page} lang={locale}>
      <nav className={styles.top} aria-label={t('navLabel')}>
        <Link href="/" className={styles.logo}>
          {SITE_NAME}
        </Link>
        <Link href={itineraryPath(destination, pt ? 'en' : 'pt')} hrefLang={pt ? 'en' : 'pt-BR'}>
          {t('otherLanguage')}
        </Link>
      </nav>

      <header className={styles.hero}>
        <p className={styles.kicker}>{t('kicker')}</p>
        <h1>{t('title', { destination: name, days: plan.days })}</h1>
        <p className={styles.lead}>
          {t('lead', { stops: plan.stops.length, nights: plan.nights })}
        </p>
        <div className={styles.currencies} role="group" aria-label={t('currencyLabel')}>
          {['USD', 'BRL', 'EUR'].map((code) => (
            <Link
              key={code}
              href={
                code === 'USD'
                  ? itineraryPath(destination, language)
                  : `?${CURRENCY_PARAM[language]}=${code}`
              }
              aria-current={code === currency ? 'true' : undefined}
              scroll={false}
            >
              {code}
            </Link>
          ))}
        </div>
      </header>

      <section className={styles.costs} aria-labelledby="cost-title">
        <h2 id="cost-title">{t('costTitle')}</h2>
        <dl>
          <div>
            <dt>{t('budget')}</dt>
            <dd>
              {fmt(plan.estimate.low)}–{fmt(plan.estimate.high)}
            </dd>
          </div>
          <div>
            <dt>{t('comfort')}</dt>
            <dd>
              {fmt(comfort.estimate.low)}–{fmt(comfort.estimate.high)}
            </dd>
          </div>
        </dl>
        <p>{t('save', { six: monthly(6), twelve: monthly(12) })}</p>
        <p className={styles.note}>
          {t('costNote', { date: researched })}
          {rate ? ` ${t('rateNote', { currency })}` : ''}
        </p>
        <Link className={styles.cta} href={`/?plano=${destination.id}#planner`}>
          {t('cta')}
        </Link>
      </section>

      <ol className={styles.stops}>
        {plan.stops.map(({ stop, nights, experiences, next }) => (
          <li key={stop.key}>
            <h2>
              {pt ? stop.namePt : stop.name}
              <span>{t('nights', { count: nights })}</span>
            </h2>
            <ul>
              {experiences.map((experience) => (
                <li key={experience.id}>
                  <strong>{pt ? experience.namePt : experience.name}</strong>
                  {experience.offbeat ? (
                    <span className={styles.offbeat}>{t('offbeat')}</span>
                  ) : null}
                  <span className={styles.price}>
                    {experience.cost[1] === 0
                      ? t('free')
                      : range(experience.cost[0], experience.cost[1])}
                  </span>
                </li>
              ))}
            </ul>
            {next ? (
              <p className={styles.leg}>
                {t(`leg.${next.mode}`)} · {range(next.cost[0], next.cost[1])}
              </p>
            ) : null}
          </li>
        ))}
      </ol>

      {/* The page speaks its own language, which can differ from the app's: the form gets that language's copy. */}
      <NextIntlClientProvider
        locale={locale}
        messages={{ interestList: catalogs[locale].interestList }}
      >
        <InterestListForm source="itinerary" locale={locale} />
      </NextIntlClientProvider>

      <section className={styles.more} aria-labelledby="more-title">
        <h2 id="more-title">{t('moreTitle')}</h2>
        <ul>
          {others.map((other) => (
            <li key={other.id}>
              <Link href={itineraryPath(other, language)}>{pt ? other.namePt : other.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
