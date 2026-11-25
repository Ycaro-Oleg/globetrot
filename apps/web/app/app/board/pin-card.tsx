'use client';

import { useTranslations } from 'next-intl';
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
import { PhotoPicker } from '../_components/photo-picker';
import styles from './world-map.module.css';

const GLYPHS: Record<KitTab, string> = { photos: '▣', spots: '⌖', notes: '✎', todos: '✓' };

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
  focusSpot = null,
  onPinSpot,
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
  /** A spot to bring into view (its mini-pin was tapped). */
  focusSpot?: number | null;
  /** "Mark on the map": the next tap on the map places this spot. */
  onPinSpot?: (draft: { name: string; kind: SpotKind }) => void;
  onTab: (tab: KitTab) => void;
  onChange: (change: Partial<RouteStop>) => void;
  onShowSpot: (spot: StopSpot) => void;
  onClose: () => void;
}) {
  const t = useTranslations('mapBoard.card');
  const counts = kitCounts(stop);
  const [note, setNote] = useState(stop.note);
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
                        </div>
                      </div>
                      {placed ? (
                        <button
                          type="button"
                          className={styles.spotGo}
                          aria-label={t('showSpot', { name: spot.name })}
                          onClick={() => onShowSpot(spot)}
                        >
                          ⌖
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
                ⌖ {t('markOnMap')}
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
