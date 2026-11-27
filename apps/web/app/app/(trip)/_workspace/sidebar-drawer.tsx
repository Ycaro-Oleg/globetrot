'use client';

import { useTranslations } from 'next-intl';
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import styles from './workspace.module.css';

/** The sidebar's width in px: never so narrow that a day label wraps, never wider than a third of a laptop. */
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 232;
/** How far one arrow key press moves the edge (Shift moves further). */
const STEP = 16;
const BIG_STEP = 48;
const STORAGE_KEY = 'globetrot.workspace.sidebar';

export type DrawerState = { readonly width: number; readonly open: boolean };

/** A width inside the limits, rounded to a whole pixel; anything unreadable becomes the default. */
export function clampWidth(value: unknown): number {
  const width = typeof value === 'number' && Number.isFinite(value) ? value : SIDEBAR_DEFAULT;
  return Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));
}

/** What the keyboard does on the resize handle: arrows step, Home and End go to the limits. */
export function widthForKey(width: number, key: string, shift: boolean): number | null {
  const step = shift ? BIG_STEP : STEP;
  if (key === 'ArrowRight') return clampWidth(width + step);
  if (key === 'ArrowLeft') return clampWidth(width - step);
  if (key === 'Home') return SIDEBAR_MIN;
  if (key === 'End') return SIDEBAR_MAX;
  return null;
}

/** The saved drawer, or the default one; a broken or missing value never throws. */
export function readDrawer(raw: string | null): DrawerState {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<DrawerState>) : {};
    return { width: clampWidth(parsed.width), open: parsed.open !== false };
  } catch {
    return { width: SIDEBAR_DEFAULT, open: true };
  }
}

const CHANGE_EVENT = 'globetrot:workspace-sidebar';
/** The last value written, for a browser that blocks storage: the change still applies to this visit. */
let memory: string | null = null;

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** The drawer's width and whether it is open, remembered on this device (the server renders the default). */
export function useDrawer(): [DrawerState, (next: DrawerState) => void] {
  const raw = useSyncExternalStore(subscribe, readStored, () => null);
  const state = useMemo(() => readDrawer(raw), [raw]);
  const update = useCallback((next: DrawerState) => {
    memory = JSON.stringify(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, memory);
    } catch {
      /* storage blocked: `memory` keeps it for this visit */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [state, update];
}

/**
 * The trip's sections as a drawer (from 720 px): a button folds it to a thin rail and opens it again, and its edge
 * drags to any width between the limits. The edge is a focusable separator, so the arrow keys (and Home and End)
 * do the same as the drag.
 */
export function SidebarDrawer({
  state,
  onChange,
  children,
}: {
  state: DrawerState;
  onChange: (next: DrawerState) => void;
  children: ReactNode;
}) {
  const t = useTranslations('workspace');
  const panelId = useId();
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startWidth: state.width };
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // Logical direction: in a right-to-left page the sidebar sits on the right and grows to the left.
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const delta = (event.clientX - drag.current.startX) * (rtl ? -1 : 1);
    onChange({ open: true, width: clampWidth(drag.current.startWidth + delta) });
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const width = widthForKey(state.width, event.key, event.shiftKey);
    if (width === null) return;
    event.preventDefault();
    onChange({ open: true, width });
  };

  return (
    <div
      className={styles.drawer}
      data-open={state.open ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
    >
      <button
        type="button"
        className={styles.drawerToggle}
        aria-expanded={state.open}
        aria-controls={panelId}
        onClick={() => onChange({ ...state, open: !state.open })}
      >
        <span aria-hidden="true">{state.open ? '«' : '»'}</span>
        <span className={state.open ? undefined : 'sr-only'}>
          {state.open ? t('sidebarHide') : t('sidebarShow')}
        </span>
      </button>
      <div id={panelId} className={styles.drawerPanel} hidden={!state.open}>
        {children}
      </div>
      {state.open ? (
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t('sidebarResize')}
          aria-controls={panelId}
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          aria-valuenow={state.width}
          className={styles.resizer}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={() => onChange({ open: true, width: SIDEBAR_DEFAULT })}
        />
      ) : null}
    </div>
  );
}
