'use client';

import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import styles from './community.module.css';

interface Toast {
  readonly text: string;
  readonly undo?: () => void;
}

interface CommunityContext {
  /** The trip a post's place is saved to ("+ Save to my trip"), or null without one. */
  readonly currentTrip: { id: string; title: string } | null;
  readonly toast: (text: string, undo?: () => void) => void;
}

const Context = createContext<CommunityContext>({ currentTrip: null, toast: () => {} });
export const useCommunity = () => useContext(Context);

/**
 * What every community screen shares: the current trip and the toasts (blue pills, with "Undo" where an action
 * can be undone). Toasts sit in a polite live region, so screen readers hear them without losing their place.
 */
export function CommunityProvider({
  currentTrip,
  children,
}: {
  currentTrip: { id: string; title: string } | null;
  children: ReactNode;
}) {
  const t = useTranslations('communityPage.toasts');
  const [current, setCurrent] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((text: string, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(undo ? { text, undo } : { text });
    timer.current = setTimeout(() => setCurrent(null), 6000);
  }, []);

  return (
    <Context.Provider value={{ currentTrip, toast }}>
      {children}
      <div className={styles.toastRegion} role="status" aria-live="polite">
        {current ? (
          <div className={styles.toast}>
            <span>{current.text}</span>
            {current.undo ? (
              <button
                type="button"
                onClick={() => {
                  current.undo?.();
                  setCurrent(null);
                }}
              >
                {t('undo')}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Context.Provider>
  );
}
