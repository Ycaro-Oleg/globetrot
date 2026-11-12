'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import {
  ITEM_MAX,
  KIT_TABS,
  NOTE_MAX,
  SPOTS_MAX,
  TODOS_MAX,
  type KitTab,
  type RouteStop,
  type StopSpot,
} from './board-route';
import styles from './world-map.module.css';

const GLYPHS: Record<KitTab, string> = { photos: '▣', spots: '⌖', notes: '✎', todos: '✓' };

/** What the petal badges and the card's tabs count. */
export function kitCounts(stop: RouteStop): Record<KitTab, string> {
  const done = stop.todos.filter((todo) => todo.done).length;
  return {
    photos: '',
    spots: stop.spots.length ? String(stop.spots.length) : '',
    notes: stop.note.trim() ? '•' : '',
    todos: stop.todos.length ? `${done}/${stop.todos.length}` : '',
  };
}

/**
 * The pin's "instance" card: a stop's own photos, spots, notes and to-dos, next to its pin on the map
 * (full width at the top on a phone). Esc closes it (handled by the board).
 */
export function PinCard({
  stop,
  index,
  name,
  when,
  tab,
  style,
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
  onTab: (tab: KitTab) => void;
  onChange: (change: Partial<RouteStop>) => void;
  onShowSpot: (spot: StopSpot) => void;
  onClose: () => void;
}) {
  const t = useTranslations('mapBoard.card');
  const counts = kitCounts(stop);
  const [note, setNote] = useState(stop.note);
  const [spotDraft, setSpotDraft] = useState('');
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
      spots: [...stop.spots, { name: text, latitude: null, longitude: null, done: false }],
    });
    setSpotDraft('');
  };
  const addTodo = (event: FormEvent) => {
    event.preventDefault();
    const text = todoDraft.trim().slice(0, ITEM_MAX);
    if (!text || stop.todos.length >= TODOS_MAX) return;
    onChange({ todos: [...stop.todos, { text, done: false }] });
    setTodoDraft('');
  };

  return (
    <div className={styles.card} style={style} role="dialog" aria-labelledby="pin-card-title">
      <div className={styles.cardHead}>
        <span className={styles.cardDisc} data-state={stop.visited ? 'visited' : 'selected'}>
          {stop.visited ? '✓' : index + 1}
        </span>
        <div className={styles.cardTitle}>
          <strong id="pin-card-title">{name}</strong>
          <span>{when}</span>
        </div>
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
          <div className={styles.photosSoon}>
            <span aria-hidden="true">▣</span>
            <p>{t('photosSoon')}</p>
          </div>
        ) : null}

        {tab === 'spots' ? (
          <>
            {stop.spots.length ? (
              <ul className={styles.checkList}>
                {stop.spots.map((spot, i) => (
                  <li key={`${spot.name}-${i}`} data-done={spot.done}>
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
                    <label htmlFor={`spot-${i}`}>
                      <span className="sr-only">{t('visited')}: </span>
                      {spot.name}
                    </label>
                    {spot.latitude !== null && spot.longitude !== null ? (
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
                ))}
              </ul>
            ) : (
              <p className={styles.cardEmpty}>{t('noSpots')}</p>
            )}
            <form className={styles.addRow} onSubmit={addSpot}>
              <input
                value={spotDraft}
                maxLength={ITEM_MAX}
                onChange={(event) => setSpotDraft(event.target.value)}
                placeholder={t('addSpot')}
                aria-label={t('addSpot')}
              />
              <button type="submit" aria-label={t('addSpot')}>
                +
              </button>
            </form>
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
