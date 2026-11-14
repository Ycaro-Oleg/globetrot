'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { track, type ConversionEvent } from '../lib/analytics';

/** A link that records a conversion when followed (nothing is recorded unless analytics is configured). */
export function TrackedLink({
  event,
  ...props
}: ComponentProps<typeof Link> & { event: ConversionEvent }) {
  return <Link {...props} onClick={() => track(event)} />;
}
