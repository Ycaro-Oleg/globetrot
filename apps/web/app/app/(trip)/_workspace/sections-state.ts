'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/** Which of the sidebar's groups are open, remembered on this device for every trip. */
const STORAGE_KEY = 'globetrot.workspace.sections';
const CHANGE_EVENT = 'globetrot:workspace-sections';

/** A group's id (only the itinerary has children today) and whether it is open. */
export type SectionsState = { readonly itinerary: boolean };
/** Every group starts folded, for every trip: the sidebar shows its five rows and nothing else. */
export const SECTIONS_DEFAULT: SectionsState = { itinerary: false };

/** The saved groups, or the default; a broken or missing value never throws. */
export function readSections(raw: string | null): SectionsState {
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<Record<keyof SectionsState, unknown>>) : {};
    return { itinerary: parsed.itinerary === true };
  } catch {
    return SECTIONS_DEFAULT;
  }
}

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

/** The sidebar's open groups (the server renders the default) and a way to change one. */
export function useSections(): [
  SectionsState,
  (section: keyof SectionsState, open: boolean) => void,
] {
  const raw = useSyncExternalStore(subscribe, readStored, () => null);
  const state = useMemo(() => readSections(raw), [raw]);
  const set = useCallback((section: keyof SectionsState, open: boolean) => {
    memory = JSON.stringify({ ...readSections(readStored()), [section]: open });
    try {
      window.localStorage.setItem(STORAGE_KEY, memory);
    } catch {
      /* storage blocked: `memory` keeps it for this visit */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [state, set];
}
