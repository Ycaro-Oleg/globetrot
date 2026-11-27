'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ACCEPTED_TYPES, mediaUrl, uploadPhoto, type UploadError } from '../../../lib/upload';
import styles from './photo-picker.module.css';

export interface PickedPhoto {
  readonly mediaId: string;
  readonly alt: string;
  /** A static image instead of an upload (the landing's demo only), with its author and licence. */
  readonly src?: string;
  readonly credit?: string;
}

/**
 * Add, describe and remove photos (up to `max`). Each photo is resized in the browser and uploaded at once;
 * the server removes location data. Every photo has a field for the words that describe it.
 */
export function PhotoPicker({
  photos,
  max,
  onChange,
  label,
  readOnly = false,
}: {
  photos: readonly PickedPhoto[];
  max: number;
  onChange: (photos: PickedPhoto[]) => void;
  /** The visible name of the add button's group, e.g. "Photos". */
  label: string;
  /** Only shows the photos, each with its description and credit (the landing's demo). */
  readOnly?: boolean;
}) {
  const t = useTranslations('photos');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<UploadError | 'full' | null>(null);
  // Several uploads finish one after another: each adds to what the previous one left.
  const latest = useRef(photos);
  useEffect(() => {
    latest.current = photos;
  }, [photos]);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    setError(null);
    const room = max - latest.current.length;
    if (files.length > room) setError('full');
    const chosen = files.slice(0, Math.max(0, room));
    if (chosen.length === 0) return;
    setUploading((n) => n + chosen.length);
    for (const file of chosen) {
      const result = await uploadPhoto(file);
      setUploading((n) => n - 1);
      if (typeof result === 'string') {
        setError(result);
        continue;
      }
      const next = [...latest.current, { mediaId: result.id, alt: '' }];
      latest.current = next;
      onChange(next);
    }
  }

  if (readOnly) {
    return (
      <div className={styles.picker}>
        <ul className={styles.grid}>
          {photos.map((photo) => (
            <li key={photo.mediaId}>
              <figure className={styles.figure}>
                {/* eslint-disable-next-line @next/next/no-img-element -- small static demo photos, already sized */}
                <img
                  src={photo.src ?? mediaUrl(photo.mediaId)}
                  alt={photo.alt}
                  className={styles.thumb}
                  loading="lazy"
                />
                {photo.credit ? <figcaption>{photo.credit}</figcaption> : null}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <fieldset className={styles.picker}>
      <legend>{label}</legend>
      {photos.length > 0 ? (
        <ul className={styles.grid}>
          {photos.map((photo, index) => (
            <li key={photo.mediaId}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a private image behind the API's access check */}
              <img src={mediaUrl(photo.mediaId)} alt="" className={styles.thumb} />
              <label htmlFor={`${id}-alt-${index}`} className={styles.srOnly}>
                {t('alt', { n: index + 1 })}
              </label>
              <input
                id={`${id}-alt-${index}`}
                value={photo.alt}
                maxLength={200}
                placeholder={t('altPlaceholder')}
                onChange={(event) =>
                  onChange(
                    photos.map((p, i) => (i === index ? { ...p, alt: event.target.value } : p)),
                  )
                }
              />
              <button
                type="button"
                className={styles.remove}
                aria-label={t('remove', { n: index + 1 })}
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length < max ? (
        <>
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept={ACCEPTED_TYPES}
            multiple={max - photos.length > 1}
            className={styles.srOnly}
            onChange={pick}
          />
          <button type="button" className={styles.add} onClick={() => input.current?.click()}>
            <span aria-hidden="true">▣</span> {t('add')}
            <span className={styles.count}>{t('left', { count: max - photos.length })}</span>
          </button>
        </>
      ) : null}
      <p className={styles.status} role="status">
        {uploading > 0 ? t('uploading', { count: uploading }) : ''}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error === 'full' ? t('full', { max }) : t(`errors.${error}`)}
        </p>
      ) : null}
      <p className={styles.note}>{t('privacy')}</p>
    </fieldset>
  );
}
