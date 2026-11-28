'use client';

import type { ThemeChoice } from '@globetrot/domain';
import { useLayoutEffect } from 'react';
import { applyTheme } from '../lib/appearance';

/**
 * Keeps the page's theme in step with the stored choice after the first paint. When the choice changes (a save
 * refreshes the layout), React may leave `data-theme` alone because its own value did not change, while the head
 * script had set something else for `system`. This runs after React's update and draws the choice again.
 */
export function ThemeSync({ choice }: { choice: ThemeChoice }) {
  useLayoutEffect(() => {
    applyTheme(choice);
  }, [choice]);
  return null;
}
