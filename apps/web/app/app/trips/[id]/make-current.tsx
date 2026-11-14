'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { selectTrip } from '../../_components/trip-actions';

/** Opening a trip's page makes it the current trip, so the bar and its tools match the page. */
export function MakeCurrent({ tripId, current }: { tripId: string; current: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (current) return;
    void selectTrip(tripId).then((changed) => {
      if (changed) router.refresh();
    });
  }, [tripId, current, router]);
  return null;
}
