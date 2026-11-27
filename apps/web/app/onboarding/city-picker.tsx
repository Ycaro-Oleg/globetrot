'use client';

import { POPULAR_PICKS, popularPlaceByKey } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import type { OnboardingPlace } from './actions';
import styles from './onboarding.module.css';

type ApiPlace = {
  key: string;
  name: string;
  countryCode: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
};

/**
 * Pick a city from the built-in list of every city of 15 000 people or more (`GET /v1/places/cities`), the way
 * airline sites do: type a few letters, see "Fortaleza · Ceará, Brazil", choose. Arrow keys move through the
 * suggestions and Enter picks. `picks` shows one-tap popular destinations before typing; `allowTyped` lets the
 * person keep a name the list does not know (it then has no point on the map).
 */
export function CityPicker({
  id,
  label,
  placeholder,
  chosen,
  onChoose,
  picks = false,
  allowTyped = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  chosen: OnboardingPlace | null;
  onChoose: (place: OnboardingPlace | null) => void;
  picks?: boolean;
  allowTyped?: boolean;
}) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const listId = useId();
  const countries = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale]);
  const [query, setQuery] = useState(chosen?.name ?? '');
  const [results, setResults] = useState<ApiPlace[]>([]);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<'idle' | 'searching' | 'error' | 'done'>('idle');

  const where = (place: { region: string | null; countryCode: string | null }) =>
    [place.region, place.countryCode ? countries.of(place.countryCode) : null]
      .filter(Boolean)
      .join(', ');

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2 || text === chosen?.name) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      setState('searching');
      try {
        const params = new URLSearchParams({ query: text, language: locale });
        const response = await fetch(`/v1/places/cities?${params}`, { signal: abort.signal });
        if (!response.ok) throw new Error('search failed');
        const found = (await response.json()) as { places: ApiPlace[] };
        setResults(found.places);
        setActive(0);
        setState('done');
      } catch {
        if (!abort.signal.aborted) setState('error');
      }
    }, 160);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [query, locale, chosen?.name]);

  const choose = (place: OnboardingPlace) => {
    onChoose(place);
    setQuery(place.name);
    setResults([]);
    setState('idle');
  };
  const open = results.length > 0;

  return (
    <div className={styles.search}>
      <label className={styles.field} htmlFor={id}>
        <span>{label}</span>
      </label>
      <div className={styles.combo}>
        <span className={styles.comboIcon} aria-hidden="true">
          ⌕
        </span>
        <input
          id={id}
          value={query}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            if (chosen && event.target.value.trim() !== chosen.name) onChoose(null);
          }}
          onKeyDown={(event) => {
            if (!open) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => (index + 1) % results.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => (index - 1 + results.length) % results.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const place = results[active];
              if (place) choose(place);
            } else if (event.key === 'Escape') {
              setResults([]);
            }
          }}
        />
        {chosen ? (
          <span className={styles.comboDone} aria-hidden="true">
            ✓
          </span>
        ) : null}
      </div>
      {open ? (
        <ul className={styles.results} id={listId} role="listbox" aria-label={label}>
          {results.map((place, index) => (
            <li
              key={place.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              data-active={index === active || undefined}
              onPointerEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
            >
              <span className={styles.resultPin} aria-hidden="true">
                ●
              </span>
              <span>
                <strong>{place.name}</strong>
                <span>{where(place)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className={styles.note} role="status">
        {state === 'searching' ? t('searching') : null}
        {state === 'error' ? t('searchUnavailable') : null}
        {state === 'done' && results.length === 0 && !chosen ? t('noResults') : null}
        {chosen && state !== 'searching'
          ? t('chosen', { name: [chosen.name, where(chosen)].filter(Boolean).join(' · ') })
          : null}
      </p>
      {allowTyped &&
      !chosen &&
      state === 'done' &&
      results.length === 0 &&
      query.trim().length >= 2 ? (
        <button
          type="button"
          className={styles.typed}
          onClick={() =>
            choose({
              key: null,
              name: query.trim().slice(0, 120),
              countryCode: null,
              region: null,
              latitude: null,
              longitude: null,
            })
          }
        >
          {t('useTyped', { name: query.trim() })}
        </button>
      ) : null}
      {picks && !chosen && query.trim().length < 2 ? (
        <div className={styles.picks}>
          <span>{t('popular')}</span>
          <ul>
            {(POPULAR_PICKS[locale === 'pt-BR' ? 'pt-BR' : 'en'] ?? []).map((key) => {
              const place = popularPlaceByKey(key);
              if (!place) return null;
              const name = locale === 'pt-BR' ? place.pt : place.en;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() =>
                      choose({
                        key: place.key,
                        name,
                        countryCode: place.countryCode,
                        region: null,
                        latitude: place.latitude,
                        longitude: place.longitude,
                      })
                    }
                  >
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      <p className={styles.credit}>{t('citiesCredit')}</p>
    </div>
  );
}
