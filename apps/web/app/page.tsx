import { formatMoney, money } from '@globetrot/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MOCK_PLANS } from '../lib/plan-config';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { siteOrigin } from '../lib/site-url';
import { setScaffoldLocale } from './actions';
import { SITE_NAME } from './site';
import {
  MoneyPlanner as BudgetPlanner,
  HeroMap,
  PipPlanner,
  StoryMap,
  ThemeToggle,
} from './landing-widgets';
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

/** Which copyable example trip each postcard opens (application/examples). */
const EXAMPLE_FOR_POSTCARD = { 1: 'portugal', 2: 'japan', 3: 'rio-de-la-plata' } as const;

export default function HomePage() {
  const t = useTranslations('landing');
  const auth = useTranslations('auth');
  const locale = useLocale();
  const usd = (whole: number) =>
    formatMoney(money(BigInt(whole) * 100n, 'USD'), locale, { precision: 'whole' });

  return (
    <div className={styles.site} data-landing>
      <header className={styles.nav}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.brand} aria-label={SITE_NAME}>
            <span className={styles.brandMark} aria-hidden="true" />
            <span>{SITE_NAME}</span>
          </Link>
          <nav className={styles.navLinks} aria-label={t('navSections')}>
            <a href="#board">{t('navBoard')}</a>
            <a href="#pip">{t('navPip')}</a>
            <a href="#money">{t('navBudget')}</a>
            <a href="#trips">{t('navExamples')}</a>
            <a href="#pricing">{t('navPricing')}</a>
          </nav>
          <div className={styles.navActions}>
            <ThemeToggle />
            <Link href="/login" className={styles.login}>
              {auth('login.submit')}
            </Link>
            <Link href="/signup" className={styles.navCta}>
              {t('navStart')}
            </Link>
            <details className={styles.mobileMenu}>
              <summary aria-label={t('navMenu')}>☰</summary>
              <nav aria-label={t('navSections')}>
                <a href="#board">{t('navBoard')}</a>
                <a href="#pip">{t('navPip')}</a>
                <a href="#money">{t('navBudget')}</a>
                <a href="#trips">{t('navExamples')}</a>
                <a href="#pricing">{t('navPricing')}</a>
                <a href="#pricing">{t('navPricing')}</a>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.heroIntro} id="top">
          <div className={styles.heroTop}>
            <h1>{t.rich('headline', { accent: (chunks) => <em>{chunks}</em> })}</h1>
            <div className={styles.heroPitch}>
              <p>{t('heroCopy')}</p>
              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.threadButton}>
                  {t('planDream')} <span aria-hidden="true">→</span>
                </Link>
                <a href="#trips" className={styles.ghostButton}>
                  {t('seeExamples')}
                </a>
              </div>
            </div>
          </div>
          <HeroMap />
        </section>

        <section className={styles.sectionAlt} aria-labelledby="story-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.eyebrow}>{t('storyEyebrow')}</span>
                <h2 id="story-title">
                  {t.rich('storyTitle', { accent: (chunks) => <em>{chunks}</em> })}
                </h2>
              </div>
              <p>{t('storyLead')}</p>
            </div>
            <StoryMap />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="stamps-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.eyebrow}>{t('stampsEyebrow')}</span>
                <h2 id="stamps-title">
                  {t.rich('stampsTitle', { accent: (chunks) => <em>{chunks}</em> })}
                </h2>
              </div>
              <p>{t('stampsLead')}</p>
            </div>
            <div className={styles.stages}>
              {[1, 2, 3, 4, 5].map((stage) => (
                <article className={styles.stage} key={stage}>
                  <span className={styles.stageNo}>{['i', 'ii', 'iii', 'iv', 'v'][stage - 1]}</span>
                  <h3>{t(`stage${stage}Title`)}</h3>
                  <p>{t(`stage${stage}Body`)}</p>
                  <div
                    className={`${styles.stageArt} ${styles[`stageArt${stage}` as keyof typeof styles]}`}
                    aria-hidden="true"
                  >
                    {stage === 1 ? (
                      <div className={styles.pinCluster}>
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : null}
                    {stage === 2 ? (
                      <svg viewBox="0 0 240 60">
                        <path d="M8 25 Q70 56 128 22 Q185 0 232 33" />
                        <circle cx="8" cy="25" r="5" />
                        <circle cx="128" cy="22" r="5" />
                        <circle cx="232" cy="33" r="5" />
                      </svg>
                    ) : null}
                    {stage === 3 ? (
                      <div className={styles.ledger}>
                        <span>{t('stageLedgerStay')}</span>
                        <i />
                        <b>✓ {usd(225)}</b>
                        <span>{t('stageLedgerTrains')}</span>
                        <i />
                        <b>≈ {usd(250)}</b>
                      </div>
                    ) : null}
                    {stage > 3 ? (
                      <div className={styles.stampArt}>
                        <small>{stage === 4 ? 'N° 5' : t('stageGoStamp')}</small>
                        <strong>{stage === 4 ? t('stagePaperStamp') : t('stageReadyStamp')}</strong>
                        <small>{stage === 4 ? '05 NOV' : '03 APR'}</small>
                      </div>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.pipSection} id="pip">
          <div className={styles.wrap}>
            <PipPlanner />
          </div>
        </section>

        <section className={styles.section} id="money">
          <div className={styles.wrap}>
            <BudgetPlanner />
          </div>
        </section>

        <section className={styles.sectionAlt} id="trips">
          <div className={styles.wrap}>
            <div className={styles.examplesHeading}>
              <div>
                <span className={styles.eyebrow}>{t('examplesEyebrow')}</span>
                <h2>{t.rich('examplesTitle', { accent: (chunks) => <em>{chunks}</em> })}</h2>
              </div>
              <Link href="/signup">
                {t('allExamples')} <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className={styles.exampleGrid}>
              {([1, 2, 3] as const).map((trip) => (
                <Link
                  href={`/app/trips?example=${EXAMPLE_FOR_POSTCARD[trip]}`}
                  className={`${styles.postcard} ${styles[`postcard${trip}` as keyof typeof styles]}`}
                  key={trip}
                >
                  <div className={styles.miniMap} aria-hidden="true">
                    <span className={styles.miniRoute} />
                    <i />
                    <i />
                    <i />
                  </div>
                  <span className={styles.postcardEyebrow}>{t(`trip${trip}Length`)}</span>
                  <h3>{t.rich(`trip${trip}Title`, { accent: (chunks) => <em>{chunks}</em> })}</h3>
                  <p>{t(`trip${trip}Body`)}</p>
                  <strong>
                    {t('tripUse')} <span aria-hidden="true">→</span>
                  </strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="platform-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.eyebrow}>{t('platformEyebrow')}</span>
                <h2 id="platform-title">
                  {t.rich('platformTitle', { accent: (chunks) => <em>{chunks}</em> })}
                </h2>
              </div>
              <p>{t('platformLead')}</p>
            </div>
            <div className={styles.platformGrid}>
              <div>
                <div className={styles.desktopMock}>
                  <div className={styles.mockSidebar}>
                    <b>{SITE_NAME}</b>
                    <span>◉ {t('mockBoard')}</span>
                    <span>▦ {t('mockDays')}</span>
                    <span>＄ {t('mockBudget')}</span>
                  </div>
                  <div className={styles.mockMap}>
                    <img src="/world-map-wide.svg" alt="" />
                    <div className={styles.mockDetail}>
                      <small>{t('mockStop')}</small>
                      <b>Kyoto</b>
                      <span>{t('mockStopMeta')}</span>
                      <div />
                    </div>
                  </div>
                </div>
                <p className={styles.caption}>{t('platformDesktop')}</p>
              </div>
              <div className={styles.phoneColumn}>
                <div className={styles.phoneMock}>
                  <div className={styles.phoneTop} />
                  <img src="/world-map-wide.svg" alt="" />
                  <i className={styles.crosshair} />
                  <span className={styles.pinHere}>{t('pinHere')}</span>
                  <div className={styles.phoneSheet}>
                    <small>{t('mockStop')}</small>
                    <b>Kyoto</b>
                    <span>{t('mockPhoneMeta')}</span>
                  </div>
                </div>
                <p className={styles.caption}>{t('platformPhone')}</p>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} id="pricing" aria-labelledby="pricing-title">
          <div className={styles.wrap}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.eyebrow}>{t('pricingEyebrow')}</span>
                <h2 id="pricing-title">
                  {t.rich('pricingTitle', { accent: (chunks) => <em>{chunks}</em> })}
                </h2>
              </div>
              <p>{t('pricingLead')}</p>
            </div>
            <ul className={styles.plans}>
              {MOCK_PLANS.map((plan) => (
                <li
                  key={plan.id}
                  className={
                    plan.highlighted ? `${styles.plan} ${styles.planHighlighted}` : styles.plan
                  }
                >
                  <h3>{t(`plans.${plan.id}.name`)}</h3>
                  <p className={styles.planTagline}>{t(`plans.${plan.id}.tagline`)}</p>
                  <p className={styles.planPrice}>
                    {t('pricingPerMonth', {
                      amount: formatMoney(money(plan.monthlyMinor, plan.currency), locale, {
                        precision: plan.monthlyMinor === 0n ? 'whole' : 'full',
                      }),
                    })}
                  </p>
                  <ul className={styles.planFeatures}>
                    {(['f1', 'f2', 'f3'] as const).map((feature) => (
                      <li key={feature}>{t(`plans.${plan.id}.${feature}`)}</li>
                    ))}
                  </ul>
                  {plan.monthlyMinor === 0n ? (
                    <Link href="/signup" className={styles.planCta}>
                      {t('pricingCta')}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className={styles.planNote}>
              <strong>{t('pricingPlaceholder')}</strong>
            </p>
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.wrap}>
            <span className={styles.eyebrow}>{t('finalEyebrow')}</span>
            <h2>{t.rich('finalTitle', { accent: (chunks) => <em>{chunks}</em> })}</h2>
            <form className={styles.finalForm} action="/signup" method="get">
              <input
                type="text"
                name="dream"
                placeholder={t('finalPlaceholder')}
                aria-label={t('finalPlaceholder')}
              />
              <button type="submit">{t('finalButton')}</button>
            </form>
            <p>{t('finalNote')}</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span className={styles.footerBrand}>{SITE_NAME}</span>
          <span>{t('mapAttribution')}</span>
          <div className={styles.footerRight}>
            <Link href="/login">{auth('login.submit')}</Link>
            <form action={setScaffoldLocale} aria-label={auth('language')}>
              <button type="submit" name="locale" value="en" aria-pressed={locale === 'en'}>
                English
              </button>
              <button type="submit" name="locale" value="pt-BR" aria-pressed={locale === 'pt-BR'}>
                Português (Brasil)
              </button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}
