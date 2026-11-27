'use client';

import { tripCalendar, type TripDay } from '@globetrot/domain';
import { formatLocalDate, type SupportedLocale } from '@globetrot/i18n';
import { Banner } from '@globetrot/ui';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { PipAvatar } from '../_components/pip-avatar';
import { StartDateForm } from '../_components/start-date-form';
import { addPlace, movePlace, removePlace, type DayIdea, type DayIdeas } from './actions';
import {
  buildBoard,
  dropTarget,
  LOAD_SCALE_HOURS,
  type BoardPlace,
  type BoardStop,
} from './day-board';
import { AskPipLink } from '../_components/ask-pip-link';
import styles from './days.module.css';

const LEGS = ['flight', 'train', 'bus', 'car', 'boat', 'walk', 'other'] as const;
type Toast = { text: string; undo?: () => void };
/** A spot the person marked on the map for a stop, as the Days page offers it. */
export type MapSpot = { readonly stopId: string; readonly name: string; readonly kind: string };
/** A typical visit for each kind of map spot, when it goes on a day (sights take longer). */
const SPOT_MINUTES: Record<string, number> = { sight: 120, food: 60, shop: 60, other: 60 };

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
  pipEnabled = false,
  ideas = null,
  mapSpots = [],
  layout = 'grid',
}: {
  pipEnabled?: boolean;
  /**
   * `grid` is the Days page; `stacked` is the itinerary inside the trip's document (one column, headings one level
   * down so the trip's title stays the page's only `h1`).
   */
  layout?: 'grid' | 'stacked';
  trip: { readonly id: string; readonly title: string; readonly startDate?: string | null } | null;
  stops: readonly BoardStop[];
  days: readonly TripDay[];
  places: readonly BoardPlace[] | null;
  /** Places worth a visit near each stop, or null when they could not be read. */
  ideas?: DayIdeas | null;
  /** The spots the person marked on the map, per stop (sights, food, shops…), offered to plan on a day. */
  mapSpots?: readonly MapSpot[];
}) {
  const t = useTranslations('daysPage');
  const Title = layout === 'stacked' ? 'h2' : 'h1';
  const Sub = layout === 'stacked' ? 'h3' : 'h2';

  if (trip === null) {
    return (
      <section className={styles.page} data-layout={layout}>
        <Title className={styles.title}>{t('title')}</Title>
        <p className={styles.sub}>{t('noTrip')}</p>
        <Link className={styles.secondary} href="/app/trips">
          {t('goTrips')}
        </Link>
      </section>
    );
  }
  if (stops.length === 0) {
    return (
      <section className={styles.page} data-layout={layout}>
        <Title className={styles.title}>{t('title')}</Title>
        <div className={styles.emptyCard}>
          <PipAvatar size={88} pose="research" />
          <Sub>{t('emptyTitle')}</Sub>
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
      <section className={styles.page} data-layout={layout}>
        <Title className={styles.title}>{t('title')}</Title>
        <Banner tone="error" role="alert">
          {t('loadError')}
        </Banner>
      </section>
    );
  }
  return (
    <Board
      tripId={trip.id}
      tripTitle={trip.title}
      startDate={trip.startDate ?? null}
      stops={stops}
      days={days}
      initial={places}
      pipEnabled={pipEnabled}
      ideas={ideas}
      mapSpots={mapSpots}
      layout={layout}
    />
  );
}

function Board({
  tripId,
  tripTitle,
  startDate,
  stops,
  days,
  initial,
  pipEnabled,
  ideas: initialIdeas,
  mapSpots,
  layout,
}: {
  layout: 'grid' | 'stacked';
  pipEnabled: boolean;
  ideas: DayIdeas | null;
  mapSpots: readonly MapSpot[];
  tripId: string;
  tripTitle: string;
  startDate: string | null;
  stops: readonly BoardStop[];
  days: readonly TripDay[];
  initial: readonly BoardPlace[];
}) {
  const t = useTranslations('daysPage');
  const locale = useLocale() as SupportedLocale;
  const stacked = layout === 'stacked';
  // One heading level down inside the trip's document, so the trip's title stays the only h1.
  const Title = stacked ? 'h2' : 'h1';
  const Column = stacked ? 'h3' : 'h2';
  const CardTitle = stacked ? 'h4' : 'h3';
  const [places, setPlaces] = useState<readonly BoardPlace[]>(initial);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [adding, setAdding] = useState(false);
  const [ideas, setIdeas] = useState(initialIdeas);

  /** Downloads the trip as a calendar file: one all-day event per day, with that day's places. */
  const exportCalendar = () => {
    const dated = days.filter((day) => day.date !== null);
    const file = tripCalendar({
      tripId,
      calendarName: tripTitle,
      now: new Date(),
      days: dated.map((day) => ({
        index: day.index,
        date: day.date!,
        summary: t('calendarSummary', {
          index: day.index,
          stop: stopName(day.stopId) ?? t('noStop'),
          trip: tripTitle,
        }),
        lines: places
          .filter((place) => place.day === day.index)
          .map((place) => `${place.name} · ${hours(place.minutes / 60)}`),
      })),
    });
    const url = URL.createObjectURL(new Blob([file], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tripTitle.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'trip'}.ics`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setToast({ text: t('calendarDone') });
  };
  /** A visit's typical time the way people say it: "45 min", "2 h", "1 h 15". */
  const duration = (minutes: number) =>
    minutes < 60
      ? t('minutes', { minutes })
      : minutes % 60 === 0
        ? t('hours', { hours: String(minutes / 60) })
        : t('hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
  const [addingIdea, setAddingIdea] = useState<string | null>(null);
  // Someone adding ideas one after another keeps them in view, even after the first one fills the plan.
  const [ideasOpen, setIdeasOpen] = useState(false);

  /** Puts an idea in "No day" with its typical time, and takes it off the ideas. */
  const addIdea = (stopId: string, idea: DayIdea) => {
    const key = `${stopId}:${idea.name}`;
    setAddingIdea(key);
    setIdeasOpen(true);
    void addPlace(tripId, { name: idea.name, destinationId: stopId, minutes: idea.minutes }).then(
      (plan) => {
        setAddingIdea(null);
        if (!plan) return setToast({ text: t('actionError') });
        setPlaces(plan.places);
        setIdeas((current) =>
          current
            ? {
                stops: current.stops.map((stop) =>
                  stop.stopId === stopId
                    ? { ...stop, ideas: stop.ideas.filter((other) => other.name !== idea.name) }
                    : stop,
                ),
              }
            : current,
        );
        setToast({ text: t('ideaAdded', { name: idea.name }) });
      },
    );
  };
  const addButton = useRef<HTMLButtonElement>(null);
  // The person's own map spots that are not on the plan yet, grouped by stop, first among the ideas.
  const planned = new Set(
    places.map((place) => `${place.destinationId}:${place.name.toLowerCase()}`),
  );
  const fromMap = stops
    .map((stop) => ({
      stopId: stop.id,
      spots: mapSpots.filter(
        (spot) => spot.stopId === stop.id && !planned.has(`${stop.id}:${spot.name.toLowerCase()}`),
      ),
    }))
    .filter((group) => group.spots.length > 0);
  const hasIdeas =
    fromMap.length > 0 || Boolean(ideas && ideas.stops.some((stop) => stop.ideas.length > 0));
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
          <CardTitle>{place.name}</CardTitle>
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
                {day.departure ? ` · ${t('departureShort')}` : ''}
              </option>
            ))}
          </select>
        </label>
      </article>
    );
  };

  const mapGroups = fromMap.map((group) => (
    <div key={`map-${group.stopId}`} className={styles.ideaGroup}>
      <h3>{t('ideasFromMap', { stop: stopName(group.stopId) ?? t('noStop') })}</h3>
      <ul>
        {group.spots.map((spot) => (
          <li key={spot.name}>
            <button
              type="button"
              className={styles.idea}
              data-mine=""
              disabled={addingIdea !== null}
              onClick={() =>
                addIdea(group.stopId, {
                  name: spot.name,
                  kind: 'landmark',
                  minutes: SPOT_MINUTES[spot.kind] ?? 60,
                } as DayIdea)
              }
            >
              <span aria-hidden="true">+</span> {spot.name}
              <span className={styles.ideaTime}>{duration(SPOT_MINUTES[spot.kind] ?? 60)}</span>
              <span className="sr-only">{t('ideaAddHint')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  ));
  const ideaGroups = ideas
    ? ideas.stops
        .filter((stop) => stop.ideas.length > 0)
        .map((stop) => (
          <div key={stop.stopId} className={styles.ideaGroup}>
            <h3>{t('ideasFor', { stop: stopName(stop.stopId) ?? t('noStop') })}</h3>
            <ul>
              {stop.ideas.map((idea) => (
                <li key={idea.name}>
                  <button
                    type="button"
                    className={styles.idea}
                    disabled={addingIdea !== null}
                    onClick={() => addIdea(stop.stopId, idea)}
                  >
                    <span aria-hidden="true">+</span> {idea.name}
                    <span className={styles.ideaTime}>{duration(idea.minutes)}</span>
                    <span className="sr-only">{t('ideaAddHint')}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className={styles.ideaSource}>
              {stop.source === 'provider' && stop.attribution
                ? stop.attribution
                : t('ideasBuiltIn')}
            </p>
          </div>
        ))
    : null;

  return (
    <section className={styles.page} data-layout={layout}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Title className={styles.title}>{t('title')}</Title>
          <span className={styles.sub}>
            {t('summary', {
              days: days.length,
              hours: hours(board.totalHours),
              full: board.fullDays,
            })}
          </span>
        </div>
        {pipEnabled ? <AskPipLink topic="days" /> : null}
        {days.some((day) => day.date !== null) ? (
          <button type="button" className={styles.calendarButton} onClick={exportCalendar}>
            {t('calendar')}
          </button>
        ) : null}
        {places.length > 0 ? (
          <button
            ref={addButton}
            type="button"
            className={styles.cta}
            onClick={() => setAdding(true)}
          >
            + {t('addPlace')}
          </button>
        ) : null}
      </header>
      {startDate === null ? (
        <div className={styles.dateBanner}>
          <p>{t('noStartDate')}</p>
          <StartDateForm tripId={tripId} startDate={null} compact />
        </div>
      ) : null}
      {places.length === 0 ? (
        // One place to begin: the ideas are the first step, and adding your own is right below them.
        <div className={styles.start}>
          <Column>{t('startTitle', { days: days.length })}</Column>
          <p>{hasIdeas ? t('startPick') : t('startText')}</p>
          {hasIdeas ? (
            <>
              {mapGroups}
              {ideaGroups}
            </>
          ) : null}
          <div className={styles.startActions}>
            <button
              ref={addButton}
              type="button"
              className={hasIdeas ? styles.ghost : styles.cta}
              onClick={() => setAdding(true)}
            >
              + {hasIdeas ? t('startOwn') : t('startCta')}
            </button>
            {pipEnabled ? <AskPipLink topic="days" /> : null}
          </div>
        </div>
      ) : (
        <>
          <p className={styles.how}>
            <strong>{t('how')}</strong> {t('howText')}
          </p>
          {hasIdeas ? (
            <details
              className={styles.moreIdeas}
              open={ideasOpen}
              onToggle={(event) => setIdeasOpen(event.currentTarget.open)}
            >
              <summary>{t('ideasTitle')}</summary>
              {mapGroups}
              {ideaGroups}
            </details>
          ) : null}
        </>
      )}

      {/* "No day" beside a grid of every day: nothing hides off to the side. */}
      <div
        className={styles.board}
        role="region"
        aria-label={t('title')}
        data-dragging={dragging ? '' : undefined}
      >
        <section
          className={styles.column}
          data-tray=""
          data-over={over === 'tray' || undefined}
          aria-labelledby="day-tray"
          {...zone('tray', null)}
        >
          <div className={styles.columnHead}>
            <div className={styles.columnTitle}>
              <Column id="day-tray">{t('tray')}</Column>
              <span className={styles.count}>{board.tray.length}</span>
            </div>
            <span className={styles.columnSub}>{t('traySub')}</span>
          </div>
          {board.tray.map((place) => card(place, null, null))}
          {board.tray.length === 0 ? (
            <p className={styles.empty}>{places.length === 0 ? t('trayFirst') : t('trayEmpty')}</p>
          ) : null}
        </section>

        <div className={styles.days}>
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
                  <Column id={`day-${day.index}`}>{t('dayLabel', { index: day.index })}</Column>
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
                {day.hours > 0 ? (
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
                ) : null}
                {day.departure ? (
                  // The last day: the person leaves, so only the morning is free. Never a block.
                  <p className={styles.departure}>{t('departure')}</p>
                ) : null}
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
              {day.places.length === 0 ? (
                <p className={styles.empty} data-free="">
                  {dragging ? t('dropHere') : t('freeDay')}
                </p>
              ) : null}
            </section>
          ))}
        </div>
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
