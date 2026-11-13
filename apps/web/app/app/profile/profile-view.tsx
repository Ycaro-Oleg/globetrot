'use client';

import {
  continentOf,
  CONTINENTS,
  DEFAULT_PIP_LOOK,
  PIP_BAG_COLORS,
  PIP_BAGS,
  PIP_HATS,
  PIP_OUTFITS,
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

type Category = 'outfit' | 'hat' | 'bag';
const SHOWN = 18;
const SWATCH: Record<PipLook['bagColor'], string> = {
  amber: '#F59E0B',
  cyan: '#06B6D4',
  pink: '#EC4899',
};

const same = (a: PipLook, b: PipLook) =>
  a.hat === b.hat && a.outfit === b.outfit && a.bag === b.bag && a.bagColor === b.bagColor;
const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!;

/**
 * The person's own profile (design handoff v2, "Profile"): their Pip on the halftone world, a few numbers, the
 * "My Pip" editor (outfit, hat, bag and its colour, a name; shuffle, undo, save) and their visas grouped by year
 * with a continent filter. Following, sharing and visa privacy arrive with the community.
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
  const [category, setCategory] = useState<Category>('outfit');
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [pending, startTransition] = useTransition();
  const dirty = !same(draft.look, saved.look) || draft.name.trim() !== saved.name.trim();
  const setLook = (change: Partial<PipLook>) => {
    setStatus('idle');
    setDraft((current) => ({ ...current, look: { ...current.look, ...change } }));
  };
  const continents = new Set(
    (visas ?? []).map((visa) => continentOf(visa.countryCode)).filter(Boolean),
  );

  const parts = [
    draft.look.outfit !== 'none' ? t(`outfits.${draft.look.outfit}`) : null,
    draft.look.hat !== 'none' ? t(`hats.${draft.look.hat}`) : null,
    `${t(`bags.${draft.look.bag}`)} (${t(`colors.${draft.look.bagColor}`).toLowerCase()})`,
  ].filter(Boolean);

  const options =
    category === 'outfit'
      ? PIP_OUTFITS.filter((value) => value !== 'none').map((value) => ({
          key: value,
          label: t(`outfits.${value}`),
          look: { ...draft.look, outfit: value },
          pressed: draft.look.outfit === value,
          choose: () => setLook({ outfit: value }),
        }))
      : category === 'hat'
        ? PIP_HATS.filter((value) => value !== 'none').map((value) => ({
            key: value,
            label: t(`hats.${value}`),
            look: { ...draft.look, hat: value },
            pressed: draft.look.hat === value,
            choose: () => setLook({ hat: value }),
          }))
        : PIP_BAGS.map((value) => ({
            key: value,
            label: t(`bags.${value}`),
            look: { ...draft.look, bag: value },
            pressed: draft.look.bag === value,
            choose: () => setLook({ bag: value }),
          }));

  return (
    <section className={styles.page}>
      <header className={styles.cover}>
        <div className={styles.coverArt} aria-hidden="true" />
        <div className={styles.identity}>
          <div className={styles.avatar}>
            <PipAvatar size={124} look={saved.look} />
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
            <p>{t('myPipSub')}</p>
          </div>
          {dirty ? <span className={styles.unsaved}>● {t('unsaved')}</span> : null}
        </div>
        <div className={styles.editor}>
          <div className={styles.preview}>
            <div className={styles.stage}>
              <PipAvatar size={220} look={draft.look} />
            </div>
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
            <p className={styles.lookText}>
              {draft.look.outfit === 'none' && draft.look.hat === 'none'
                ? t('lookBare')
                : t('lookSummary', { parts: parts.join(' · ') })}
            </p>
          </div>

          <div className={styles.controls}>
            <div className={styles.tabs} role="tablist" aria-label={t('parts')}>
              {(['outfit', 'hat', 'bag'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  id={`pip-tab-${key}`}
                  aria-selected={category === key}
                  aria-controls="pip-panel"
                  onClick={() => setCategory(key)}
                >
                  {key === 'outfit' ? t('tabOutfit') : key === 'hat' ? t('tabHat') : t('tabBag')}
                </button>
              ))}
            </div>
            <div id="pip-panel" role="tabpanel" aria-labelledby={`pip-tab-${category}`}>
              <p className={styles.typeTitle}>
                {category === 'outfit'
                  ? t('pickOutfit')
                  : category === 'hat'
                    ? t('pickHat')
                    : t('pickBag')}
              </p>
              <div className={styles.options}>
                {options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={option.pressed}
                    onClick={option.choose}
                  >
                    <span className={styles.thumb}>
                      <PipAvatar size={84} look={option.look} still />
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
              {category !== 'bag' ? (
                <button
                  type="button"
                  className={styles.none}
                  aria-pressed={
                    category === 'outfit' ? draft.look.outfit === 'none' : draft.look.hat === 'none'
                  }
                  onClick={() =>
                    setLook(category === 'outfit' ? { outfit: 'none' } : { hat: 'none' })
                  }
                >
                  {category === 'outfit' ? t('noOutfit') : t('noHat')}
                </button>
              ) : (
                <div className={styles.colors}>
                  <p className={styles.typeTitle}>{t('bagColor')}</p>
                  <div>
                    {PIP_BAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-pressed={draft.look.bagColor === color}
                        onClick={() => setLook({ bagColor: color })}
                      >
                        <span style={{ background: SWATCH[color] }} aria-hidden="true" />
                        {t(`colors.${color}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.editorActions}>
              <button
                type="button"
                className={styles.ghost}
                onClick={() =>
                  setLook({
                    hat: pick(PIP_HATS),
                    outfit: pick(PIP_OUTFITS),
                    bag: pick(PIP_BAGS),
                    bagColor: pick(PIP_BAG_COLORS),
                  })
                }
              >
                ⟳ {t('shuffle')}
              </button>
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
                    const result = await savePip(draft.look, draft.name);
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
