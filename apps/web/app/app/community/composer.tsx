'use client';

import { POST_BODY_MAX, POST_PHOTOS_MAX } from '@globetrot/domain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { forwardRef, useId, useState, useTransition, type FormEvent } from 'react';
import type { PostData } from '../../../lib/community';
import { PhotoPicker, type PickedPhoto } from '../_components/photo-picker';
import { PipAvatar } from '../_components/pip-avatar';
import { publishPost } from './actions';
import { useCommunity } from './community-context';
import { useCountryName } from './post-card';
import styles from './community.module.css';

type Kind = PostData['kind'];
const KINDS: readonly { kind: Kind; glyph: string }[] = [
  { kind: 'moment', glyph: '◐' },
  { kind: 'tip', glyph: '✦' },
  { kind: 'route', glyph: '→' },
  { kind: 'visa', glyph: '✓' },
  { kind: 'goal', glyph: '★' },
];
const ERRORS = ['RATE_LIMITED', 'NOT_FOUND', 'VALIDATION_ERROR'] as const;

export interface ComposerTrip {
  readonly id: string;
  readonly title: string;
}
export interface ComposerPlace {
  readonly name: string;
  readonly countryCode: string | null;
}

/**
 * The inline composer (design handoff v2): one line until focused, then the kind chips, the text with its
 * counter, a place (suggested from the current trip's stops), the trip or visa to attach, who sees it, and the
 * coral "Post". A route, visa or goal is copied from the person's own data when they post; nothing else is.
 */
export const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    trips: readonly ComposerTrip[];
    visas: readonly { countryCode: string; city: string }[];
    places: readonly ComposerPlace[];
    onPosted: (post: PostData) => void;
  }
>(function Composer({ trips, visas, places, onPosted }, textRef) {
  const t = useTranslations('communityPage.composer');
  const tToast = useTranslations('communityPage.toasts');
  const { toast, currentTrip } = useCommunity();
  const router = useRouter();
  const country = useCountryName();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('moment');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [tripId, setTripId] = useState(currentTrip?.id ?? trips[0]?.id ?? '');
  const [visaCountry, setVisaCountry] = useState(visas[0]?.countryCode ?? '');
  const [hideAmounts, setHideAmounts] = useState(true);
  const [audience, setAudience] = useState<PostData['audience']>('everyone');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const needsWords = kind === 'moment' || kind === 'tip';
  const usesTrip = kind === 'route' || kind === 'goal';

  function reset() {
    setOpen(false);
    setKind('moment');
    setBody('');
    setPlace('');
    setPhotos([]);
    setAudience('everyone');
    setHideAmounts(true);
    setError(null);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (needsWords && !body.trim() && photos.length === 0) return setError(t('errors.empty'));
    if (usesTrip && !tripId) return setError(t('errors.trip'));
    if (kind === 'visa' && !visaCountry) return setError(t('errors.visa'));
    const name = place.trim();
    const known = places.find((p) => p.name.toLowerCase() === name.toLowerCase());
    startTransition(async () => {
      const result = await publishPost({
        kind,
        body: body.trim(),
        audience,
        place: name && kind !== 'visa' ? { name, countryCode: known?.countryCode ?? null } : null,
        ...(usesTrip ? { tripId } : {}),
        ...(kind === 'route' ? { showAmounts: !hideAmounts } : {}),
        ...(kind === 'visa' ? { visaCountry } : {}),
        ...(needsWords && photos.length > 0
          ? { photos: photos.map((photo) => ({ mediaId: photo.mediaId, alt: photo.alt.trim() })) }
          : {}),
      });
      if ('error' in result) {
        const code = ERRORS.find((known) => known === result.error);
        return setError(code ? t(`errors.${code}`) : t('errors.UNKNOWN'));
      }
      onPosted(result);
      reset();
      toast(tToast('posted'));
      // The side column learns the person's new handle.
      router.refresh();
    });
  }

  return (
    <form
      className={styles.composer}
      data-open={open || undefined}
      onSubmit={submit}
      aria-labelledby={`${id}-label`}
      noValidate
    >
      <h2 id={`${id}-label`} className={styles.srOnly}>
        {t('label')}
      </h2>
      <div className={styles.composerTop}>
        <PipAvatar size={40} still />
        <div className={styles.composerText}>
          <label htmlFor={`${id}-text`} className={styles.srOnly}>
            {t('text')}
          </label>
          <textarea
            ref={textRef}
            id={`${id}-text`}
            value={body}
            rows={open ? 3 : 1}
            maxLength={POST_BODY_MAX}
            placeholder={open ? t(`placeholders.${kind}`) : t('prompt')}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error && needsWords && !body.trim() && !photos.length ? true : undefined}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setBody(event.target.value);
              setError(null);
            }}
          />
          {open ? (
            <span
              className={styles.counter}
              data-near={body.length > 450 || undefined}
              aria-live="polite"
            >
              {t('counter', { count: body.length })}
            </span>
          ) : null}
        </div>
      </div>

      {open ? (
        <>
          <fieldset className={styles.kinds}>
            <legend className={styles.srOnly}>{t('kindLabel')}</legend>
            {KINDS.map((entry) => (
              <button
                key={entry.kind}
                type="button"
                aria-pressed={kind === entry.kind}
                onClick={() => {
                  setKind(entry.kind);
                  setError(null);
                }}
              >
                <span aria-hidden="true">{entry.glyph}</span> {t(`kinds.${entry.kind}`)}
              </button>
            ))}
          </fieldset>

          {needsWords ? (
            <PhotoPicker
              photos={photos}
              max={POST_PHOTOS_MAX}
              onChange={setPhotos}
              label={t('photos')}
            />
          ) : null}

          {usesTrip ? (
            <div className={styles.field}>
              <label htmlFor={`${id}-trip`}>{t('trip')}</label>
              {trips.length > 0 ? (
                <select
                  id={`${id}-trip`}
                  value={tripId}
                  onChange={(event) => setTripId(event.target.value)}
                >
                  <option value="" disabled>
                    {t('chooseTrip')}
                  </option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={styles.muted}>{t('noTrips')}</p>
              )}
              <small>{kind === 'route' ? t('routeHint') : t('goalHint')}</small>
              {kind === 'route' ? (
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={hideAmounts}
                    onChange={(event) => setHideAmounts(event.target.checked)}
                  />
                  {t('hideAmounts')}
                </label>
              ) : null}
            </div>
          ) : null}

          {kind === 'visa' ? (
            <div className={styles.field}>
              <label htmlFor={`${id}-visa`}>{t('visa')}</label>
              {visas.length > 0 ? (
                <select
                  id={`${id}-visa`}
                  value={visaCountry}
                  onChange={(event) => setVisaCountry(event.target.value)}
                >
                  {visas.map((visa) => (
                    <option key={visa.countryCode} value={visa.countryCode}>
                      {country(visa.countryCode)} · {visa.city}
                    </option>
                  ))}
                </select>
              ) : (
                <p className={styles.muted}>{t('noVisas')}</p>
              )}
            </div>
          ) : (
            <div className={styles.field}>
              <label htmlFor={`${id}-place`}>{t('place')}</label>
              <input
                id={`${id}-place`}
                value={place}
                maxLength={120}
                list={`${id}-places`}
                placeholder={t('placeHint')}
                onChange={(event) => setPlace(event.target.value)}
              />
              <datalist id={`${id}-places`}>
                {places.map((p) => (
                  <option key={p.name} value={p.name} />
                ))}
              </datalist>
            </div>
          )}

          <div className={styles.composerFoot}>
            <fieldset className={styles.segmented}>
              <legend>{t('audience')}</legend>
              {(['everyone', 'followers'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={audience === value}
                  onClick={() => setAudience(value)}
                >
                  {t(value)}
                </button>
              ))}
            </fieldset>
            <div className={styles.row}>
              <button type="button" className={styles.ghost} onClick={reset}>
                {t('cancel')}
              </button>
              <button type="submit" className={styles.cta} disabled={pending}>
                {pending ? t('publishing') : t('publish')}
              </button>
            </div>
          </div>
          {error ? (
            <p id={`${id}-error`} role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
        </>
      ) : null}
    </form>
  );
});
