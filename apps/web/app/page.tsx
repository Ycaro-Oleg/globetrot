import { formatMoney, money, PLAN_TERMS, POPULAR_PLACES, TRIAL_TERMS } from '@globetrot/domain';
import type { Metadata } from 'next';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { siteOrigin } from '../lib/site-url';
import { setScaffoldLocale } from './actions';
import { demoMap } from '../lib/demo-map';
import { AnswerCalculator } from './landing-calculator';
import { DemoMapBoard } from './landing-demo-map';
import { HeroRoutes } from './landing-hero-routes';
import { LandingPip } from './landing-pip';
import { LandingReveal } from './landing-reveal';
import { LandingScroll, Words } from './landing-scroll';
import { PipDemo, Pricing } from './landing-interactive';
import { StickyCta } from './landing-sticky-cta';
import { ConsentLink } from './analytics';
import { TrackedLink } from './tracked-link';
import { SITE_NAME } from './site';
import styles from './landing.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, origin] = await Promise.all([
    getTranslations('landing'),
    getLocale(),
    siteOrigin(),
  ]);
  const title = t('metaTitle');
  const description = t('metaDescription');
  return {
    metadataBase: origin,
    title,
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title,
      description,
      url: '/',
      locale: locale.replace('-', '_'),
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Which copyable example trip each card opens (application/examples). */
const EXAMPLES = [
  { n: 1, id: 'portugal' },
  { n: 2, id: 'japan' },
  { n: 3, id: 'rio-de-la-plata' },
] as const;

/** The scrolling band of destinations: two rows of twelve, spread around the world. */
const MARQUEE = [
  'Lisbon',
  'Tokyo',
  'Rio de Janeiro',
  'Paris',
  'Cape Town',
  'New York',
  'Bali',
  'Buenos Aires',
  'Rome',
  'Reykjavik',
  'Cusco',
  'Seoul',
  'Marrakech',
  'Sydney',
  'Jericoacoara',
  'Istanbul',
  'Mexico City',
  'Santorini',
  'Kyoto',
  'Ushuaia',
  'Barcelona',
  'Havana',
  'Dubai',
  'Fernando de Noronha',
];

/**
 * The public landing page (design handoff v2, "Landing"): a dark hero over the halftone world, how it works in
 * three steps, Pip with a live approve / dismiss demo, copyable example trips, placeholder pricing and a FAQ.
 * Every amount is in USD, the default currency, and labelled as an example or a placeholder.
 */
export default function HomePage() {
  const t = useTranslations('landing');
  const auth = useTranslations('auth');
  const locale = useLocale();
  // Destinations for the scrolling band, in the page's language (proper names, not copy).
  const places = MARQUEE.flatMap((name) => {
    const place = POPULAR_PLACES.find((candidate) => candidate.en === name);
    return place ? [locale === 'pt-BR' ? place.pt : place.en] : [];
  });
  const usd = (whole: number) =>
    formatMoney(money(BigInt(whole) * 100n, 'USD'), locale, { precision: 'whole' });
  const price = (minor: bigint) => formatMoney(money(minor, 'USD'), locale, { precision: 'full' });
  // Prices and the trial length come from the domain, so the answer cannot drift from the pricing table.
  const faqValues = {
    days: TRIAL_TERMS.days,
    explorerMonthly: price(PLAN_TERMS.explorer.monthlyMinor),
    explorerAnnual: price(PLAN_TERMS.explorer.annualMinor),
    voyagerMonthly: price(PLAN_TERMS.voyager.monthlyMinor),
    voyagerAnnual: price(PLAN_TERMS.voyager.annualMinor),
  };
  const accent = (chunks: React.ReactNode) => <span className={styles.accent}>{chunks}</span>;

  const steps = [
    {
      n: '01',
      title: t('step1Title'),
      body: t('step1Body'),
      tone: 'light',
      demo: [
        ['1', t('demoCity1'), t('demoNights', { count: 4 })],
        ['2', t('demoCity2'), t('demoNights', { count: 4 })],
        ['3', t('demoCity3'), t('demoNights', { count: 3 })],
      ],
    },
    {
      n: '02',
      title: t('step2Title'),
      body: t('step2Body'),
      tone: 'dark',
      demo: [
        ['●', t('demoPaid'), usd(1380)],
        ['✓', t('demoConfirmed'), usd(647)],
        ['≈', t('demoEstimate'), usd(1775)],
      ],
    },
    {
      n: '03',
      title: t('step3Title'),
      body: t('step3Body'),
      tone: 'blue',
      demo: [
        ['$', t('demoSaved'), usd(1450)],
        ['+', t('demoMonthly'), usd(900)],
        [
          '✓',
          t('demoReady'),
          new Intl.DateTimeFormat(locale, {
            month: 'short',
            year: 'numeric',
            timeZone: 'UTC',
          }).format(new Date('2027-03-15T12:00:00Z')),
        ],
      ],
    },
  ] as const;

  return (
    <div className={styles.site} data-landing>
      <section className={styles.hero} id="top" aria-labelledby="hero-title">
        <header className={styles.nav}>
          <Link href="/" className={styles.brand}>
            <span className={styles.brandRing} aria-hidden="true" />
            <span>{SITE_NAME.toLowerCase()}</span>
          </Link>
          <nav className={styles.navLinks} aria-label={t('navSections')}>
            <a href="#how">{t('navHow')}</a>
            <a href="#pip">{t('navPip')}</a>
            <a href="#trips">{t('navExamples')}</a>
            <a href="#pricing">{t('navPricing')}</a>
          </nav>
          <div className={styles.navActions}>
            <form action={setScaffoldLocale} aria-label={auth('language')} className={styles.lang}>
              <button type="submit" name="locale" value="en" aria-pressed={locale === 'en'}>
                EN
              </button>
              <button type="submit" name="locale" value="pt-BR" aria-pressed={locale === 'pt-BR'}>
                PT
              </button>
            </form>
            <Link href="/login" className={styles.login}>
              {t('navLogin')}
            </Link>
            <TrackedLink href="/signup" className={styles.navCta} event="cta_click">
              {t('navStart')}
            </TrackedLink>
          </div>
        </header>

        <div className={styles.heroCopy}>
          <span className={styles.heroKicker}>{t('kicker')}</span>
          <h1 id="hero-title">{t.rich('heroTitle', { accent })}</h1>
          <p>{t('heroLead')}</p>
          <div className={styles.heroActions}>
            <TrackedLink href="/signup" className={styles.cta} event="cta_click">
              {t('heroCta')} <span aria-hidden="true">→</span>
            </TrackedLink>
            <a href="#how" className={styles.heroGhost}>
              {t('heroCta2')}
            </a>
          </div>
          <span className={styles.heroNote}>{t('heroNote')}</span>
        </div>

        <div className={styles.world} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- a decorative SVG, already the right size */}
          <img
            src="/world-halftone-blue.svg"
            alt=""
            width={1322}
            height={654}
            fetchPriority="high"
            decoding="async"
          />
          <HeroRoutes />
        </div>
        <AnswerCalculator signupHref="/signup" />
      </section>

      <ul className={styles.facts} aria-label={t('factsLabel')}>
        {(['fact1', 'fact2', 'fact3', 'fact4', 'fact5'] as const).map((key) => (
          <li key={key}>
            <strong>{t(`${key}Title`)}</strong>
            <span>{t(`${key}Body`)}</span>
          </li>
        ))}
      </ul>

      <main>
        <section className={styles.section} id="see" aria-labelledby="see-title">
          <div className={styles.heading} data-reveal>
            <span className={styles.kicker}>{t('seeKicker')}</span>
            <h2 id="see-title" data-words>
              <Words text={t('seeTitle')} />
            </h2>
            <p className={styles.seeBody}>{t('seeBody')}</p>
          </div>
          <div className={styles.zoomFrame} data-zoom-reveal>
            <DemoMapBoard map={demoMap()} />
          </div>
        </section>

        <section className={styles.section} id="how" aria-labelledby="how-title" data-step-path>
          <div className={styles.heading} data-reveal>
            <span className={styles.kicker}>{t('howKicker')}</span>
            <h2 id="how-title">{t('howTitle')}</h2>
          </div>
          <div className={styles.stepsWrap}>
            <svg
              className={styles.stepPath}
              viewBox="0 0 1000 80"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M10 50 C 180 0, 330 90, 500 40 S 820 0, 990 46"
                pathLength={1}
                className={styles.stepPathTrack}
              />
              <path
                d="M10 50 C 180 0, 330 90, 500 40 S 820 0, 990 46"
                pathLength={1}
                className={styles.stepPathLine}
                data-path-line
              />
              <path
                d="M10 50 C 180 0, 330 90, 500 40 S 820 0, 990 46"
                pathLength={1}
                className={styles.stepPathDash}
                data-path-dash
              />
            </svg>
            <ol className={styles.steps}>
              {steps.map((step) => (
                <li key={step.n} className={styles.step} data-tone={step.tone} data-path-step>
                  <span className={styles.stepNumber}>{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                  <ul className={styles.demo} aria-hidden="true">
                    {step.demo.map(([glyph, label, value]) => (
                      <li key={label}>
                        <span>
                          <i>{glyph}</i>
                          {label}
                        </span>
                        <b>{value}</b>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className={styles.marquee} data-marquee aria-hidden="true">
          {[0, 1].map((row) => (
            <div key={row} className={styles.marqueeRow} data-marquee-row>
              {[
                ...places.slice(row * 12, row * 12 + 12),
                ...places.slice(row * 12, row * 12 + 12),
              ].map((place, index) => (
                <span key={index} data-outline={index % 2 === 1 || undefined}>
                  {place}
                  <i>✦</i>
                </span>
              ))}
            </div>
          ))}
        </div>

        <section className={styles.band} id="pip" aria-labelledby="pip-title">
          <div className={styles.pipGrid}>
            <div className={styles.heading} data-reveal>
              <LandingPip />
              <span className={styles.kicker}>Pip</span>
              <h2 id="pip-title">{t('pipTitle')}</h2>
              <p className={styles.lead}>{t('pipBody')}</p>
            </div>
            <PipDemo />
          </div>
        </section>

        <section className={styles.section} id="trips" aria-labelledby="trips-title">
          <div className={styles.heading} data-reveal>
            <span className={styles.kicker}>{t('examplesKicker')}</span>
            <h2 id="trips-title">{t('examplesTitle')}</h2>
          </div>
          <ul className={styles.examples}>
            {EXAMPLES.map(({ n, id }) => (
              <li key={id}>
                <Link
                  href={`/signup?next=${encodeURIComponent(`/app/trips?example=${id}`)}`}
                  className={styles.example}
                  data-reveal
                >
                  <span className={styles.exampleLength}>{t(`trip${n}Length`)}</span>
                  <strong>{t.rich(`trip${n}Title`, { accent })}</strong>
                  <span>{t(`trip${n}Body`)}</span>
                  <b>
                    {t('examplesUse')} <span aria-hidden="true">→</span>
                  </b>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section} id="pricing" aria-labelledby="pricing-title">
          <Pricing />
        </section>

        <section className={styles.band} id="faq" aria-labelledby="faq-title">
          <div className={styles.faq}>
            <h2 id="faq-title">{t('faqTitle')}</h2>
            {([5, 6, 1, 7, 2, 8, 4, 3] as const).map((n) => (
              <details key={n} className={styles.question}>
                <summary>
                  {t(`faq${n}Q`)}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{t(`faq${n}A`, faqValues)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.closing} id="start" aria-labelledby="start-title">
          <h2 id="start-title" data-words>
            <Words text={t('closeTitle')} />
          </h2>
          <p>{t('closeBody')}</p>
          <div className={styles.heroActions}>
            <TrackedLink href="/signup" className={styles.cta} event="cta_click">
              {t('heroCta')} <span aria-hidden="true">→</span>
            </TrackedLink>
            <Link href="/login" className={styles.heroGhost}>
              {t('closeLogin')}
            </Link>
          </div>
          <span className={styles.heroNote}>{t('heroNote')}</span>
        </section>
        <LandingReveal />
        <LandingScroll />
      </main>
      <StickyCta label={t('stickyCta')} note={t('stickyNote')} />

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.brand}>
            <span className={styles.brandRing} aria-hidden="true" />
            <span>{SITE_NAME.toLowerCase()}</span>
          </span>
          <span>{t('footTagline')}</span>
          <span>{t('mapAttribution')}</span>
          <nav className={styles.footerLinks} aria-label={SITE_NAME}>
            <Link href="/terms">{t('footTerms')}</Link>
            <Link href="/privacy">{t('footPrivacy')}</Link>
            <Link href="/login">{t('navLogin')}</Link>
            <ConsentLink label={t('cookiePrefs')} />
          </nav>
        </div>
      </footer>
    </div>
  );
}
