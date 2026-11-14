'use client';

import type { TripDay } from '@globetrot/domain';
import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { PipAvatar } from '../_components/pip-avatar';
import { StartDateForm } from '../_components/start-date-form';
import { addPlace, movePlace, removePlace } from './actions';
import {
  buildBoard,
  dropTarget,
  LOAD_SCALE_HOURS,
  type BoardPlace,
  type BoardStop,
} from './day-board';
import styles from './days.module.css';

const LEGS = ['flight', 'train', 'bus', 'car', 'boat', 'walk', 'other'] as const;
type Toast = { text: string; undo?: () => void };

/**
 * The days of the current trip (design handoff v2, "Days"): a "No day" tray and one column per day, each with its
 * places, the hours planned and the move from the previous city. Places move by drag and drop or, with the keyboard
 * and on a phone, with the "Move to" select on every card. Every move can be undone.
 */
export function DaysView({
  trip,
  stops,
  days,
  places,
}: {
  trip: { readonly id: string; readonly title: string; readonly startDate?: string | null } | null;
  stops: readonly BoardStop[];
  days: readonly TripDay[];
  places: readonly BoardPlace[] | null;
}) {
  const t = useTranslations('daysPage');

  if (trip === null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.sub}>{t('noTrip')}</p>
        <Link className={styles.secondary} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }
  if (stops.length === 0) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <div className={styles.emptyCard}>
          <PipAvatar size={88} />
          <h2>{t('emptyTitle')}</h2>
          <p>{t('noStops')}</p>
          <div className={styles.emptyActions}>
            <Link className={styles.cta} href="/app/board">
              {t('goBoard')}
            </Link>
            <Link className={styles.secondary} href="/app/trips?example=japan">
              {t('tryExample')}
            </Link>
          </div>
        </div>
      </section>
    );
  }
  if (places === null) {
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{t('title')}</h1>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }
  return (
    <Board
      tripId={trip.id}
      startDate={trip.startDate ?? null}
      stops={stops}
      days={days}
      initial={places}
    />
  );
}

function Board({
  tripId,
  startDate,
  stops,
  days,
  initial,
}: {
  tripId: string;
  startDate: string | null;
  stops: readonly BoardStop[];
  days: readonly TripDay[];
  initial: readonly BoardPlace[];
}) {
  const t = useTranslations('daysPage');
  const locale = useLocale() as SupportedLocale;
  const [places, setPlaces] = useState<readonly BoardPlace[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLButtonElement>(null);
  const board = buildBoard(days, stops, places);
  const stopName = (id: string | null) => stops.find((stop) => stop.id === id)?.name ?? null;
  const hours = (value: number) =>
    t('hours', {
      hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value),
    });
  const dayName = (index: number | null) => (index === null ? t('tray') : t('dayLabel', { index }));

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** Moves optimistically, then takes the server's plan (or puts things back). */
  const move = (placeId: string, day: number | null, beforeId?: string, quiet = false) => {
    const before = places;
    const moving = places.find((place) => place.id === placeId);
    if (!moving) return;
    const rest = places.filter((place) => place.id !== placeId);
    let at = beforeId ? rest.findIndex((place) => place.id === beforeId) : -1;
    if (at < 0) {
      at = rest.length;
      for (let index = rest.length - 1; index >= 0; index--) {
        if (rest[index]!.day === day) {
          at = index + 1;
          break;
        }
      }
    }
    setPlaces([...rest.slice(0, at), { ...moving, day }, ...rest.slice(at)]);
    // To undo: back to its old day, before the place that followed it there.
    const oldIndex = before.findIndex((place) => place.id === placeId);
    const nextThere = before.slice(oldIndex + 1).find((place) => place.day === moving.day);
    void movePlace(tripId, placeId, day, beforeId).then((plan) => {
      if (!plan) {
        setPlaces(before);
        setToast({ text: t('actionError') });
        return;
      }
      setPlaces(plan.places);
      if (!quiet) {
        setToast({
          text: t('moved', { name: moving.name, target: dayName(day) }),
          undo: () => move(placeId, moving.day, nextThere?.id, true),
        });
      }
    });
  };

  const remove = (place: BoardPlace) => {
    const before = places;
    setPlaces(places.filter((candidate) => candidate.id !== place.id));
    void removePlace(tripId, place.id).then((plan) => {
      if (!plan) {
        setPlaces(before);
        setToast({ text: t('actionError') });
        return;
      }
      setPlaces(plan.places);
      setToast({
        text: t('removed', { name: place.name }),
        undo: () =>
          void addPlace(tripId, {
            name: place.name,
            destinationId: place.destinationId,
            minutes: place.minutes,
          }).then((restored) => {
            if (!restored) return setToast({ text: t('actionError') });
            const added = restored.places.at(-1);
            setPlaces(restored.places);
            if (added && place.day !== null) move(added.id, place.day, undefined, true);
          }),
      });
    });
  };

  const zone = (key: string, day: number | null) => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      if (over !== key) setOver(key);
    },
    onDragLeave: (event: DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && over === key)
        setOver(null);
    },
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      const id = dragging ?? event.dataTransfer.getData('text/plain');
      setDragging(null);
      setOver(null);
      if (id) move(id, day);
    },
  });

  const card = (place: BoardPlace, columnDay: number | null, columnStopId: string | null) => {
    const warn =
      columnDay !== null && place.destinationId !== null && place.destinationId !== columnStopId;
    return (
      <article
        key={place.id}
        className={styles.card}
        data-warn={warn || undefined}
        data-dragging={dragging === place.id || undefined}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', place.id);
          setDragging(place.id);
        }}
        onDragEnd={() => {
          setDragging(null);
          setOver(null);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const id = dragging ?? event.dataTransfer.getData('text/plain');
          setDragging(null);
          setOver(null);
          const target = id ? dropTarget(id, { day: columnDay, beforeId: place.id }) : null;
          if (id && target) move(id, target.day, target.beforeId);
        }}
      >
        <div className={styles.cardHead}>
          <h3>{place.name}</h3>
          <button
            type="button"
            className={styles.remove}
            aria-label={t('remove', { name: place.name })}
            onClick={() => remove(place)}
          >
            ×
          </button>
        </div>
        <div className={styles.tags}>
          <span className={styles.hoursTag}>{hours(place.minutes / 60)}</span>
          <span>{stopName(place.destinationId) ?? t('noStop')}</span>
        </div>
        {warn ? (
          <p className={styles.warn}>
            ▲ {t('outside', { stop: stopName(columnStopId) ?? t('noStop') })}
          </p>
        ) : null}
        <label className={styles.moveTo}>
          <span aria-hidden="true">{t('moveTo')}</span>
          <select
            aria-label={t('moveLabel', { name: place.name })}
            value={place.day === null || place.day > days.length ? '' : String(place.day)}
            onChange={(event) =>
              move(place.id, event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">{t('tray')}</option>
            {board.days.map((day) => (
              <option key={day.index} value={day.index}>
                {t('dayLabel', { index: day.index })}
                {day.stop ? ` · ${day.stop.name}` : ''}
              </option>
            ))}
          </select>
        </label>
      </article>
    );
  };

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{t('title')}</h1>
          <span className={styles.sub}>
            {t('summary', {
              days: days.length,
              hours: hours(board.totalHours),
              full: board.fullDays,
            })}
          </span>
        </div>
        <button
          ref={addButton}
          type="button"
          className={styles.cta}
          onClick={() => setAdding(true)}
        >
          + {t('addPlace')}
        </button>
      </header>
      {startDate === null ? (
        <div className={styles.dateBanner}>
          <p>{t('noStartDate')}</p>
          <StartDateForm tripId={tripId} startDate={null} compact />
        </div>
      ) : null}
      <p className={styles.how}>
        <strong>{t('how')}</strong> {t('howText')}
      </p>

      {/* Scrolls sideways on wide screens: focusable, so the keyboard can scroll it too. */}
      <div className={styles.board} role="region" aria-label={t('title')} tabIndex={0}>
        <section
          className={styles.column}
          data-tray=""
          data-over={over === 'tray' || undefined}
          aria-labelledby="day-tray"
          {...zone('tray', null)}
        >
          <div className={styles.columnHead}>
            <div className={styles.columnTitle}>
              <h2 id="day-tray">{t('tray')}</h2>
              <span className={styles.count}>{board.tray.length}</span>
            </div>
            <span className={styles.columnSub}>{t('traySub')}</span>
          </div>
          {board.tray.map((place) => card(place, null, null))}
          {board.tray.length === 0 ? <p className={styles.empty}>{t('trayEmpty')}</p> : null}
        </section>

        {board.days.map((day) => (
          <section
            key={day.index}
            className={styles.column}
            data-over={over === `d${day.index}` || undefined}
            aria-labelledby={`day-${day.index}`}
            {...zone(`d${day.index}`, day.index)}
          >
            <div className={styles.columnHead}>
              <div className={styles.columnTitle}>
                <h2 id={`day-${day.index}`}>{t('dayLabel', { index: day.index })}</h2>
                {day.stop ? <span className={styles.stopChip}>{day.stop.name}</span> : null}
              </div>
              <span className={styles.columnSub}>
                {day.date
                  ? formatLocalDate(day.date, locale, {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })
                  : t('noDate')}
              </span>
              <div className={styles.load} data-load={day.load}>
                <span aria-hidden="true">
                  <span
                    style={{ width: `${Math.min(100, (day.hours / LOAD_SCALE_HOURS) * 100)}%` }}
                  />
                </span>
                <span>
                  {hours(day.hours)} · {t(day.load)}
                </span>
              </div>
              {day.travel ? (
                <p className={styles.travel}>
                  →{' '}
                  {t('travel', {
                    mode: t(
                      `legs.${(LEGS as readonly string[]).includes(day.travel.mode) ? day.travel.mode : 'other'}`,
                    ),
                    from: day.travel.from,
                    to: day.travel.to,
                  })}
                </p>
              ) : null}
            </div>
            {day.places.map((place) => card(place, day.index, day.stopId))}
            {day.places.length === 0 ? <p className={styles.empty}>{t('dropHere')}</p> : null}
          </section>
        ))}
      </div>

      {adding ? (
        <AddPlaceDialog
          stops={stops}
          onClose={() => {
            setAdding(false);
            addButton.current?.focus();
          }}
          onSubmit={async (input) => {
            const plan = await addPlace(tripId, input);
            if (!plan) return false;
            setPlaces(plan.places);
            setAdding(false);
            addButton.current?.focus();
            return true;
          }}
        />
      ) : null}

      {toast ? (
        <div className={styles.toast} role="status">
          <span>{toast.text}</span>
          {toast.undo ? (
            <button
              type="button"
              onClick={() => {
                const undo = toast.undo;
                setToast(null);
                undo?.();
              }}
            >
              {t('undo')}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function AddPlaceDialog({
  stops,
  onClose,
  onSubmit,
}: {
  stops: readonly BoardStop[];
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    destinationId: string | null;
    minutes: number;
  }) => Promise<boolean>;
}) {
  const t = useTranslations('daysPage');
  const locale = useLocale();
  const titleId = useId();
  const first = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [stop, setStop] = useState(stops[0]?.id ?? '');
  const [hours, setHours] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError(t('fError'));
      return;
    }
    setBusy(true);
    const ok = await onSubmit({
      name: name.trim(),
      destinationId: stop || null,
      minutes: Math.round(hours * 60),
    });
    setBusy(false);
    if (!ok) setError(t('actionError'));
  };
  const hoursText = t('hours', {
    hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours),
  });

  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <form
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        noValidate
      >
        <div className={styles.dialogHead}>
          <h2 id={titleId}>{t('addPlace')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('close')}>
            ×
          </button>
        </div>
        <label className={styles.field}>
          <span>{t('fName')}</span>
          <input
            ref={first}
            id="place-name"
            value={name}
            maxLength={120}
            autoComplete="off"
            placeholder={t('fNamePh')}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </label>
        <label className={styles.field}>
          <span>{t('fStop')}</span>
          <select id="place-stop" value={stop} onChange={(event) => setStop(event.target.value)}>
            {stops.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value="">{t('noStop')}</option>
          </select>
        </label>
        <label className={styles.slider}>
          <span>
            <span>{t('fHours')}</span>
            <strong>{hoursText}</strong>
          </span>
          <input
            id="place-hours"
            type="range"
            min={0.5}
            max={8}
            step={0.5}
            value={hours}
            aria-valuetext={hoursText}
            onChange={(event) => setHours(Number(event.target.value))}
          />
        </label>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.submit} disabled={busy}>
          {t('fSubmit')}
        </button>
      </form>
    </>
  );
}
