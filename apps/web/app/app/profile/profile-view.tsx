'use client';

import {
  continentOf,
  CONTINENTS,
  DEFAULT_PIP_LOOK,
  type Continent,
  type PipLook,
} from '@globetrot/domain';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import type { VisaData } from '../../../lib/trips';
import { PipAvatar } from '../_components/pip-avatar';
import { savePip } from './actions';
import styles from './profile.module.css';

const SHOWN = 18;

/**
 * The person's own profile (design handoff v2, "Profile"): their Pip on the halftone world, a few numbers, "My Pip"
 * (its name; the wardrobe is switched off for now, Pip is the globe) and their visas grouped by year with a
 * continent filter. Following, sharing and visa privacy arrive with the community.
 */
export function ProfileView({
  name,
  homeCity,
  look: savedLook,
  pipName: savedName,
  tripCount,
  visas,
}: {
  name: string;
  homeCity: string | null;
  look: PipLook | null;
  pipName: string | null;
  tripCount: number;
  visas: readonly VisaData[] | null;
}) {
  const t = useTranslations('profilePage');
  const [saved, setSaved] = useState<{ look: PipLook; name: string }>({
    look: savedLook ?? DEFAULT_PIP_LOOK,
    name: savedName ?? '',
  });
  const [draft, setDraft] = useState(saved);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  const dirty = draft.name.trim() !== saved.name.trim();
  const continents = new Set(
    (visas ?? []).map((visa) => continentOf(visa.countryCode)).filter(Boolean),
  );

  return (
    <section className={styles.page}>
      <header className={styles.cover}>
        <div className={styles.coverArt} aria-hidden="true" />
        <div className={styles.identity}>
          <div className={styles.avatar}>
            <PipAvatar size={124} />
          </div>
          <div className={styles.who}>
            <h1>{name}</h1>
            {homeCity ? <span>{t('homeFrom', { city: homeCity })}</span> : null}
          </div>
          <div className={styles.coverActions}>
            <a href="#my-pip" className={styles.primary}>
              {t('editPip')}
            </a>
            <Link href="/settings" className={styles.ghost}>
              {t('settings')}
            </Link>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>{t('statCountries')}</dt>
              <dd>{visas?.length ?? 0}</dd>
            </div>
            <div>
              <dt>{t('statContinents')}</dt>
              <dd>{continents.size}</dd>
            </div>
            <div>
              <dt>{t('statTrips')}</dt>
              <dd>{tripCount}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className={styles.card} id="my-pip" aria-labelledby="my-pip-title">
        <div className={styles.cardHead}>
          <div>
            <h2 id="my-pip-title">{t('myPip')}</h2>
            <p>{t('myPipGlobe')}</p>
          </div>
          {dirty ? <span className={styles.unsaved}>● {t('unsaved')}</span> : null}
        </div>
        <div className={styles.nameOnly}>
          <div className={styles.stage}>
            <PipAvatar size={180} />
          </div>
          <div className={styles.nameForm}>
            <label className={styles.field}>
              <span>{t('pipName')}</span>
              <input
                id="pip-name"
                value={draft.name}
                maxLength={16}
                placeholder="Pip"
                autoComplete="off"
                onChange={(event) => {
                  setStatus('idle');
                  setDraft((current) => ({ ...current, name: event.target.value }));
                }}
              />
              <small>{t('pipNameHelp')}</small>
            </label>
            <div className={styles.editorActions}>
              {dirty ? (
                <button type="button" className={styles.ghost} onClick={() => setDraft(saved)}>
                  {t('revert')}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.cta}
                disabled={!dirty || pending}
                onClick={() =>
                  startTransition(async () => {
                    // The stored look is kept as it is, for when the wardrobe comes back.
                    const result = await savePip(saved.look, draft.name);
                    if (result.ok) {
                      setSaved(draft);
                      setStatus('saved');
                    } else setStatus('error');
                  })
                }
              >
                {t('save')}
              </button>
            </div>
            <p role="status" className={styles.status} data-error={status === 'error' || undefined}>
              {status === 'saved' ? `✓ ${t('saved')}` : null}
              {status === 'error' ? t('saveError') : null}
            </p>
          </div>
        </div>
      </section>

      <Visas visas={visas} />
    </section>
  );
}

function Visas({ visas }: { visas: readonly VisaData[] | null }) {
  const t = useTranslations('profilePage');
  const locale = useLocale();
  const [continent, setContinent] = useState<Continent | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  if (visas === null) {
    return (
      <section className={styles.card} aria-labelledby="visas-title">
        <h2 id="visas-title">{t('visas')}</h2>
        <Banner tone="error" role="alert">
          {t('saveError')}
        </Banner>
      </section>
    );
  }

  const country = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
    } catch {
      return code;
    }
  };
  const date = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
  const counts = new Map<Continent, number>();
  for (const visa of visas) {
    const where = continentOf(visa.countryCode);
    if (where) counts.set(where, (counts.get(where) ?? 0) + 1);
  }
  const filtered = visas.filter(
    (visa) => continent === null || continentOf(visa.countryCode) === continent,
  );
  const shown = all ? filtered : filtered.slice(0, SHOWN);
  const years = [...new Set(shown.map((visa) => visa.stampedAt.slice(0, 4)))];
  const detail = visas.find((visa) => visa.countryCode === chosen) ?? null;

  return (
    <section className={styles.card} aria-labelledby="visas-title">
      <div className={styles.cardHead}>
        <div>
          <h2 id="visas-title">{t('visas')}</h2>
          <p>{t('visaSummary', { countries: visas.length, continents: counts.size })}</p>
        </div>
      </div>

      {visas.length === 0 ? (
        <div className={styles.empty}>
          <PipAvatar size={110} />
          <strong>{t('emptyTitle')}</strong>
          <span>{t('emptyBody')}</span>
          <Link href="/app/board" className={styles.primary}>
            {t('emptyCta')}
          </Link>
        </div>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label={t('continentFilter')}>
            <button
              type="button"
              aria-pressed={continent === null}
              onClick={() => setContinent(null)}
            >
              {t('allContinents')} <span>{visas.length}</span>
            </button>
            {CONTINENTS.filter((key) => counts.has(key)).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={continent === key}
                onClick={() => setContinent(key)}
              >
                {t(`continents.${key}`)} <span>{counts.get(key)}</span>
              </button>
            ))}
          </div>

          {detail ? (
            <div className={styles.detail} role="status">
              <span className={styles.detailStamp} aria-hidden="true">
                <b>{detail.countryCode}</b>
                <span>{detail.stampedAt.slice(0, 4)}</span>
              </span>
              <div>
                <strong>{country(detail.countryCode)}</strong>
                <span>
                  {detail.city} · {date(detail.stampedAt)}
                </span>
              </div>
              <button type="button" onClick={() => setChosen(null)} aria-label={t('close')}>
                ×
              </button>
            </div>
          ) : null}

          {years.map((year) => {
            const ofYear = shown.filter((visa) => visa.stampedAt.startsWith(year));
            return (
              <div key={year} className={styles.year}>
                <div className={styles.yearHead}>
                  <span>{year}</span>
                  <span aria-hidden="true" />
                  <span>{ofYear.length}</span>
                </div>
                <ul className={styles.stamps}>
                  {ofYear.map((visa) => (
                    <li key={visa.countryCode}>
                      <button
                        type="button"
                        aria-pressed={chosen === visa.countryCode}
                        onClick={() =>
                          setChosen(chosen === visa.countryCode ? null : visa.countryCode)
                        }
                      >
                        <b aria-hidden="true">{visa.countryCode}</b>
                        <span aria-hidden="true">{`’${visa.stampedAt.slice(2, 4)}`}</span>
                        <span className={styles.srOnly}>
                          {t('stampLabel', {
                            country: country(visa.countryCode),
                            city: visa.city,
                            date: date(visa.stampedAt),
                          })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {filtered.length > SHOWN ? (
            <button
              type="button"
              className={styles.ghost}
              aria-expanded={all}
              onClick={() => setAll(!all)}
            >
              {all ? t('seeFewer') : t('seeAll', { count: filtered.length })}
            </button>
          ) : null}
        </>
      )}
      <p className={styles.note}>{t('visaNote')}</p>
    </section>
  );
}
