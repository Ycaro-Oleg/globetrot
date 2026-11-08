'use client';

import { useCallback, useEffect, useState } from 'react';

/** How long a person waits before asking for another email. The server enforces its own cooldown too. */
export const RESEND_COOLDOWN_SECONDS = 30;

/** Whole seconds until `endsAt`, never negative. Rounds up, so "1" shows until the very end. */
export function secondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** A countdown to show on a button. `start(seconds)` begins (or restarts) it. */
export function useCountdown(initialSeconds = 0) {
  const [endsAt, setEndsAt] = useState(() =>
    initialSeconds > 0 ? Date.now() + initialSeconds * 1000 : 0,
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= endsAt) clearInterval(timer);
    }, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setEndsAt(current + seconds * 1000);
  }, []);

  return { remaining: secondsLeft(endsAt, now), start };
}
