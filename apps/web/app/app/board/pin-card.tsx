'use client';

import { shortestSpotOrder, spotLegs } from '@globetrot/domain';
import { useLocale, useTranslations } from 'next-intl';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ITEM_MAX,
  KIT_TABS,
  SPOT_ICONS,
  SPOT_KINDS,
  spotKindOf,
  NOTE_MAX,
  SPOTS_MAX,
  PHOTOS_MAX,
  TODOS_MAX,
  type KitTab,
  type RouteStop,
  type SpotKind,
  type StopSpot,
} from './board-route';
import type { NearbyPlace } from './map-canvas';
import { PipAvatar } from '../_components/pip-avatar';

/** One spot Pip offered: always one of the real places the map showed near the stop. */
export type PipSpotChange = {
  kind: 'addSpot';
  stopId: string;
  name: string;
  spotKind: SpotKind;
  latitude: number;
  longitude: number;
  reason: string;
};

/** "Pip, suggest places" for one stop: the request, what Pip offered and which of them the person keeps. */
export type PipFill = {
  placeKey: string;
  state: 'asking' | 'ready' | 'empty' | 'applied' | 'error';
  proposalId: string | null;
  changes: PipSpotChange[];
  picked: number[];
  error: string | null;
};
import { PhotoPicker } from '../_components/photo-picker';
import styles from './world-map.module.css';

const GLYPHS: Record<KitTab, string> = { photos: '▣', spots: '◎', notes: '✎', todos: '✓' };

/** What the petal badges and the card's tabs count. */
export function kitCounts(stop: RouteStop): Record<KitTab, string> {
  const done = stop.todos.filter((todo) => todo.done).length;
  return {
    photos: stop.photos.length ? String(stop.photos.length) : '',
    spots: stop.spots.length ? String(stop.spots.length) : '',
    notes: stop.note.trim() ? '•' : '',
    todos: stop.todos.length ? `${done}/${stop.todos.length}` : '',
  };
}

/**
 * The pin's "instance" card: a stop's own photos, spots, notes and to-dos, next to its pin on the map
 * (full width at the top on a phone). It can be dragged by its title bar and expanded into a tall side panel;
 * Expand and Close are buttons, so the keyboard needs no dragging. Esc closes it (handled by the board).
 */
export function PinCard({
  stop,
  index,
  name,
  when,
  tab,
  style,
  expanded = false,
  onToggleExpand,
  onDragStart,
  nearby = null,
  photosReadOnly = false,
  focusSpot = null,
  onPinSpot,
  onShowRoute,
  pip = null,
  onTab,
  onChange,
  onShowSpot,
  onClose,
}: {
  stop: RouteStop;
  index: number;
  name: string;
  when: string;
  tab: KitTab;
  style: CSSProperties;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Starts dragging the card from its title bar (not from its buttons). */
  onDragStart?: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Real points of interest near the stop (from the map tiles), offered as spots with their place. */
  nearby?: readonly NearbyPlace[] | null;
  /** The landing's demo: its photos are shown with their credit, never added or removed. */
  photosReadOnly?: boolean;
  /** A spot to bring into view (its mini-pin was tapped). */
  focusSpot?: number | null;
  /** "Mark on the map": the next tap on the map places this spot. */
  onPinSpot?: (draft: { name: string; kind: SpotKind }) => void;
  /** "Pip, suggest places", when Pip is on for this trip. */
  pip?: {
    fill: PipFill | null;
    onAsk: () => void;
    onToggle: (index: number) => void;
    onApply: () => void;
    onDiscard: () => void;
    onUndo: () => void;
  } | null;
  /** Frames every placed spot of this stop on the map. */
  onShowRoute?: (points: [longitude: number, latitude: number][]) => void;
  onTab: (tab: KitTab) => void;
  onChange: (change: Partial<RouteStop>) => void;
  onShowSpot: (spot: StopSpot) => void;
  onClose: () => void;
}) {
  const t = useTranslations('mapBoard.card');
  const counts = kitCounts(stop);
  const [note, setNote] = useState(stop.note);
  const noteField = useRef<HTMLTextAreaElement>(null);
  // The note grows with its text, so nobody has to drag it open (browsers without CSS field sizing).
  useEffect(() => {
    const field = noteField.current;
    if (!field || CSS.supports?.('field-sizing', 'content')) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight + 2}px`;
  }, [note, tab]);
  const [spotDraft, setSpotDraft] = useState('');
  const [spotKind, setSpotKind] = useState<SpotKind>('sight');
  const spotInput = useRef<HTMLInputElement>(null);
  const focusedRow = useRef<HTMLLIElement>(null);
  useEffect(() => {
    focusedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [focusSpot]);
  const [todoDraft, setTodoDraft] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef(note);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);
  const savedNote = useRef(stop.note);

  // The note saves itself a moment after typing stops, and when the card closes or the tab changes.
  useEffect(() => {
    if (note === savedNote.current) return;
    const timer = window.setTimeout(() => {
      savedNote.current = note;
      onChange({ note });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [note, onChange]);
  useEffect(
    () => () => {
      if (noteRef.current !== savedNote.current) onChange({ note: noteRef.current });
    },
    // Only on unmount: flush what was typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, [stop.id]);

  const done = stop.todos.filter((todo) => todo.done).length;
  const addSpot = (event: FormEvent) => {
    event.preventDefault();
    const text = spotDraft.trim().slice(0, ITEM_MAX);
    if (!text || stop.spots.length >= SPOTS_MAX) return;
    onChange({
      spots: [
        ...stop.spots,
        { name: text, kind: spotKind, latitude: null, longitude: null, done: false },
      ],
    });
    setSpotDraft('');
  };
  /** A real place near the stop becomes a spot with its place on the map and a kind read from the map. */
  const addNearby = (place: NearbyPlace) => {
    if (stop.spots.length >= SPOTS_MAX) return;
    onChange({
      spots: [
        ...stop.spots,
        {
          name: place.name.slice(0, ITEM_MAX),
          kind: spotKindOf(place.kind),
          latitude: place.latitude,
          longitude: place.longitude,
          done: false,
        },
      ],
    });
    setSpotDraft('');
  };
  // The route between the placed spots: letters in list order, straight legs, a shorter order on request.
  const locale = useLocale();
  const placedCount = stop.spots.filter(
    (spot) => spot.latitude !== null && spot.longitude !== null,
  ).length;
  const letters = new Map<number, string>();
  stop.spots.forEach((spot, index) => {
    if (spot.latitude !== null && spot.longitude !== null)
      letters.set(index, String.fromCharCode(65 + (letters.size % 26)));
  });
  const km = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: 1,
  });
  const route = stop.spotRoute ? spotLegs(stop.spots) : null;
  const moveSpot = (from: number, to: number) => {
    if (to < 0 || to >= stop.spots.length) return;
    const next = [...stop.spots];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    onChange({ spots: next });
  };
  const taken = new Set(stop.spots.map((spot) => spot.name.toLowerCase()));
  const query = spotDraft.trim().toLowerCase();
  const suggestions = (nearby ?? [])
    .filter((place) => !taken.has(place.name.toLowerCase()))
    .filter((place) => (query ? place.name.toLowerCase().includes(query) : true))
    .slice(0, 5);
  const addTodo = (event: FormEvent) => {
    event.preventDefault();
    const text = todoDraft.trim().slice(0, ITEM_MAX);
    if (!text || stop.todos.length >= TODOS_MAX) return;
    onChange({ todos: [...stop.todos, { text, done: false }] });
    setTodoDraft('');
  };

  return (
    <div
      className={styles.card}
      style={style}
      role="dialog"
      aria-labelledby="pin-card-title"
      data-pin-card=""
      data-expanded={expanded || undefined}
    >
      <div
        className={styles.cardHead}
        data-draggable={onDragStart && !expanded ? '' : undefined}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest('button')) return;
          onDragStart?.(event);
        }}
      >
        {onDragStart && !expanded ? (
          <span className={styles.cardGrip} aria-hidden="true" title={t('drag')}>
            ⠿
          </span>
        ) : null}
        <span className={styles.cardDisc} data-state={stop.visited ? 'visited' : 'selected'}>
          {stop.visited ? '✓' : index + 1}
        </span>
        <div className={styles.cardTitle}>
          <strong id="pin-card-title">{name}</strong>
          <span>{when}</span>
        </div>
        {onToggleExpand ? (
          <button
            type="button"
            className={styles.cardClose}
            onClick={onToggleExpand}
            aria-label={expanded ? t('collapse') : t('expand')}
            aria-pressed={expanded}
          >
            <span aria-hidden="true">{expanded ? '⤡' : '⤢'}</span>
          </button>
        ) : null}
        <button
          ref={closeRef}
          type="button"
          className={styles.cardClose}
          onClick={onClose}
          aria-label={t('close')}
        >
          ×
        </button>
      </div>
      <div className={styles.cardTabs} role="tablist" aria-label={name}>
        {KIT_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`pin-tab-${key}`}
            aria-selected={tab === key}
            aria-controls="pin-card-panel"
            onClick={() => onTab(key)}
          >
            <span aria-hidden="true">
              {GLYPHS[key]} {counts[key]}
            </span>
            {t(`tabs.${key}`)}
          </button>
        ))}
      </div>
      <div
        className={styles.cardBody}
        role="tabpanel"
        id="pin-card-panel"
        aria-labelledby={`pin-tab-${tab}`}
      >
        {tab === 'photos' ? (
          <PhotoPicker
            photos={stop.photos}
            max={PHOTOS_MAX}
            label={t('photosLabel', { stop: name })}
            readOnly={photosReadOnly}
            onChange={(photos) => onChange({ photos })}
          />
        ) : null}

        {tab === 'spots' ? (
          <>
            {stop.spots.length ? (
              <ul className={styles.checkList}>
                {stop.spots.map((spot, i) => {
                  const placed = spot.latitude !== null && spot.longitude !== null;
                  return (
                    <li
                      key={`${spot.name}-${i}`}
                      data-done={spot.done}
                      data-focus={focusSpot === i || undefined}
                      ref={focusSpot === i ? focusedRow : undefined}
                    >
                      <input
                        type="checkbox"
                        id={`spot-${i}`}
                        checked={spot.done}
                        onChange={() =>
                          onChange({
                            spots: stop.spots.map((item, j) =>
                              j === i ? { ...item, done: !item.done } : item,
                            ),
                          })
                        }
                      />
                      {stop.spotRoute && letters.has(i) ? (
                        <span className={styles.spotLetter} aria-hidden="true">
                          {letters.get(i)}
                        </span>
                      ) : null}
                      <span className={styles.spotIcon} data-kind={spot.kind} aria-hidden="true">
                        {SPOT_ICONS[spot.kind]}
                      </span>
                      <div className={styles.spotMain}>
                        <label htmlFor={`spot-${i}`}>
                          <span className="sr-only">{t('visited')}: </span>
                          {spot.name}
                        </label>
                        <div className={styles.spotMeta}>
                          <select
                            className={styles.spotKind}
                            aria-label={t('kindOf', { name: spot.name })}
                            value={spot.kind}
                            onChange={(event) =>
                              onChange({
                                spots: stop.spots.map((item, j) =>
                                  j === i
                                    ? { ...item, kind: event.target.value as SpotKind }
                                    : item,
                                ),
                              })
                            }
                          >
                            {SPOT_KINDS.map((kind) => (
                              <option key={kind} value={kind}>
                                {t(`kinds.${kind}`)}
                              </option>
                            ))}
                          </select>
                          {placed ? null : (
                            <small className={styles.spotNoPlace}>{t('noPlace')}</small>
                          )}
                          {stop.spotRoute ? (
                            <span className={styles.spotOrder}>
                              <button
                                type="button"
                                aria-label={t('moveSpotUp', { name: spot.name })}
                                disabled={i === 0}
                                onClick={() => moveSpot(i, i - 1)}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label={t('moveSpotDown', { name: spot.name })}
                                disabled={i === stop.spots.length - 1}
                                onClick={() => moveSpot(i, i + 1)}
                              >
                                ↓
                              </button>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {placed ? (
                        <button
                          type="button"
                          className={styles.spotGo}
                          aria-label={t('showSpot', { name: spot.name })}
                          onClick={() => onShowSpot(spot)}
                        >
                          ◎
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.itemRemove}
                        aria-label={t('removeItem', { name: spot.name })}
                        onClick={() => onChange({ spots: stop.spots.filter((_, j) => j !== i) })}
                      >
                        ×
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              // What belongs here, said plainly; each line picks that kind for the next spot.
              <div className={styles.cardGuide}>
                <strong>{t('spotsGuideTitle', { place: name })}</strong>
                <ul>
                  {(
                    [
                      ['stay', 'spotsGuideStay'],
                      ['food', 'spotsGuideFood'],
                      ['sight', 'spotsGuideSight'],
                    ] as const
                  ).map(([kind, key]) => (
                    <li key={kind}>
                      <button
                        type="button"
                        onClick={() => {
                          setSpotKind(kind);
                          spotInput.current?.focus();
                        }}
                      >
                        <span aria-hidden="true">{SPOT_ICONS[kind]}</span> {t(key)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {placedCount >= 2 ? (
              <div className={styles.spotRoute}>
                <button
                  type="button"
                  className={styles.routeToggle}
                  aria-pressed={stop.spotRoute}
                  onClick={() => onChange({ spotRoute: !stop.spotRoute })}
                >
                  <span aria-hidden="true">A→B</span> {t('routeToggle')}
                </button>
                {route ? (
                  <>
                    <ol className={styles.routeLegs} aria-label={t('routeLegs')}>
                      {route.legs.map((leg, index) => (
                        <li key={index}>
                          <span>
                            {String.fromCharCode(65 + index)} → {String.fromCharCode(66 + index)}
                          </span>
                          <span>≈ {km.format(leg.km)}</span>
                        </li>
                      ))}
                    </ol>
                    <p className={styles.routeTotal}>
                      {t('routeTotal', { km: km.format(route.totalKm) })}
                    </p>
                    <div className={styles.routeActions}>
                      {placedCount >= 3 ? (
                        <button
                          type="button"
                          className={styles.markOnMap}
                          onClick={() => onChange({ spots: shortestSpotOrder(stop.spots) })}
                        >
                          {t('routeShortest')}
                        </button>
                      ) : null}
                      {onShowRoute ? (
                        <button
                          type="button"
                          className={styles.markOnMap}
                          onClick={() =>
                            onShowRoute(
                              stop.spots
                                .filter((spot) => spot.latitude !== null && spot.longitude !== null)
                                .map((spot) => [spot.longitude!, spot.latitude!]),
                            )
                          }
                        >
                          ◎ {t('routeShow')}
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
            {pip ? (
              <div className={styles.pipFill} aria-live="polite">
                {!pip.fill || pip.fill.state === 'error' ? (
                  <>
                    <button type="button" className={styles.pipFillAsk} onClick={pip.onAsk}>
                      <PipAvatar size={28} still bare />
                      <span>{t('pipAsk', { place: name })}</span>
                    </button>
                    {pip.fill?.error ? (
                      <p className={styles.pipFillError} role="alert">
                        {t(`pipErrors.${pip.fill.error}`)}
                      </p>
                    ) : (
                      <small className={styles.cardHint}>{t('pipAskHint')}</small>
                    )}
                  </>
                ) : pip.fill.state === 'asking' ? (
                  <p className={styles.pipFillStatus}>
                    <PipAvatar size={28} pose="research" bare /> {t('pipAsking')}
                  </p>
                ) : pip.fill.state === 'empty' ? (
                  <p className={styles.pipFillStatus}>
                    {t('pipEmpty')}{' '}
                    <button type="button" className={styles.pipFillLink} onClick={pip.onDiscard}>
                      {t('pipClose')}
                    </button>
                  </p>
                ) : pip.fill.state === 'applied' ? (
                  <p className={styles.pipFillStatus}>
                    {t('pipApplied', { count: pip.fill.picked.length })}{' '}
                    <button type="button" className={styles.pipFillLink} onClick={pip.onUndo}>
                      {t('pipUndo')}
                    </button>
                  </p>
                ) : (
                  <>
                    <strong className={styles.pipFillTitle}>
                      {t('pipOffers', { place: name })}
                    </strong>
                    <ul className={styles.pipFillList}>
                      {pip.fill.changes.map((change, index) => (
                        <li key={`${change.name}-${index}`}>
                          <input
                            type="checkbox"
                            id={`pip-spot-${index}`}
                            checked={pip.fill!.picked.includes(index)}
                            onChange={() => pip.onToggle(index)}
                          />
                          <label htmlFor={`pip-spot-${index}`}>
                            <span aria-hidden="true">{SPOT_ICONS[change.spotKind]}</span>{' '}
                            <strong>{change.name}</strong>
                            <small>
                              {t(`kinds.${change.spotKind}`)}
                              {change.reason ? ` · ${change.reason}` : ''}
                            </small>
                          </label>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.routeActions}>
                      <button
                        type="button"
                        className={styles.pipFillApply}
                        disabled={!pip.fill.picked.length}
                        onClick={pip.onApply}
                      >
                        {t('pipApply', { count: pip.fill.picked.length })}
                      </button>
                      <button type="button" className={styles.markOnMap} onClick={pip.onDiscard}>
                        {t('pipDiscard')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
            <div className={styles.kindPicker} role="radiogroup" aria-label={t('kindPick')}>
              {SPOT_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={spotKind === kind}
                  onClick={() => setSpotKind(kind)}
                >
                  <span aria-hidden="true">{SPOT_ICONS[kind]}</span> {t(`kinds.${kind}`)}
                </button>
              ))}
            </div>
            <form className={styles.addRow} onSubmit={addSpot}>
              <input
                ref={spotInput}
                value={spotDraft}
                maxLength={ITEM_MAX}
                onChange={(event) => setSpotDraft(event.target.value)}
                placeholder={t('addSpotKind', { kind: t(`kinds.${spotKind}`).toLowerCase() })}
                aria-label={t('addSpot')}
              />
              <button type="submit" aria-label={t('addSpot')}>
                +
              </button>
            </form>
            {suggestions.length ? (
              <div className={styles.spotSuggest}>
                <span className={styles.spotSuggestTitle}>{t('nearbyTitle')}</span>
                <ul>
                  {suggestions.map((place) => (
                    <li key={`${place.name}-${place.longitude}`}>
                      <button type="button" onClick={() => addNearby(place)}>
                        <span aria-hidden="true">{SPOT_ICONS[spotKindOf(place.kind)]}</span>
                        <span>{place.name}</span>
                        <small>{t(`kinds.${spotKindOf(place.kind)}`)}</small>
                        <span className="sr-only">{t('nearbyAddHint')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {onPinSpot ? (
              <button
                type="button"
                className={styles.markOnMap}
                onClick={() => {
                  onPinSpot({ name: spotDraft.trim().slice(0, ITEM_MAX), kind: spotKind });
                  setSpotDraft('');
                }}
              >
                ◎ {t('markOnMap')}
              </button>
            ) : null}
            <small className={styles.cardHint}>{t('spotsHint')}</small>
          </>
        ) : null}

        {tab === 'notes' ? (
          <>
            <label htmlFor="stop-note" className="sr-only">
              {t('notesLabel')}
            </label>
            <textarea
              id="stop-note"
              ref={noteField}
              className={styles.noteField}
              value={note}
              maxLength={NOTE_MAX}
              rows={6}
              placeholder={t('notesPlaceholder')}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => {
                if (note !== savedNote.current) {
                  savedNote.current = note;
                  onChange({ note });
                }
              }}
            />
            <small className={styles.autosave}>✓ {t('autosave')}</small>
          </>
        ) : null}

        {tab === 'todos' ? (
          <>
            <div className={styles.progress}>
              <span
                role="progressbar"
                aria-label={t('progress')}
                aria-valuemin={0}
                aria-valuemax={stop.todos.length}
                aria-valuenow={done}
              >
                <span
                  style={{ width: `${stop.todos.length ? (done / stop.todos.length) * 100 : 0}%` }}
                />
              </span>
              <b>
                {done}/{stop.todos.length}
              </b>
            </div>
            {stop.todos.length ? (
              <ul className={styles.checkList}>
                {stop.todos.map((todo, i) => (
                  <li key={`${todo.text}-${i}`} data-done={todo.done}>
                    <input
                      type="checkbox"
                      id={`todo-${i}`}
                      checked={todo.done}
                      onChange={() =>
                        onChange({
                          todos: stop.todos.map((item, j) =>
                            j === i ? { ...item, done: !item.done } : item,
                          ),
                        })
                      }
                    />
                    <label htmlFor={`todo-${i}`}>{todo.text}</label>
                    <button
                      type="button"
                      className={styles.itemRemove}
                      aria-label={t('removeItem', { name: todo.text })}
                      onClick={() => onChange({ todos: stop.todos.filter((_, j) => j !== i) })}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.cardEmpty}>{t('noTodos')}</p>
            )}
            <form className={styles.addRow} onSubmit={addTodo}>
              <input
                value={todoDraft}
                maxLength={ITEM_MAX}
                onChange={(event) => setTodoDraft(event.target.value)}
                placeholder={t('addTodo')}
                aria-label={t('addTodo')}
              />
              <button type="submit" aria-label={t('addTodo')}>
                +
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
