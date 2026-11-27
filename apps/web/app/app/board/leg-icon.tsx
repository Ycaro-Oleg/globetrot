import type { LegMode } from '@globetrot/domain';

/**
 * The way to the next stop as a small line drawing. Drawn here rather than taken from emoji, which some systems
 * show as empty boxes. Constant markup only: the map's leg badges set it as HTML, the route list renders it.
 */
const SHAPES: Record<LegMode, string> = {
  flight:
    '<path d="M12 3c.8 0 1.4.7 1.4 1.5V10l7.6 4.4V16l-7.6-2.2v4.4l2.2 1.6V21L12 20l-3.6 1v-1.2l2.2-1.6v-4.4L3 16v-1.6L10.6 10V4.5C10.6 3.7 11.2 3 12 3z"/>',
  train:
    '<rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 19l-2 2.5M15 19l2 2.5M8.5 13h.01M15.5 13h.01"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7.5 18v3M16.5 18v3M8 14.5h.01M16 14.5h.01"/>',
  car: '<path d="M4 16v-5l2.2-5h11.6l2.2 5v5z"/><path d="M4 11h16M7 16v3M17 16v3M8 13.5h.01M16 13.5h.01"/>',
  boat: '<path d="M3 15l2.2 5h13.6L21 15l-9-3z"/><path d="M12 12V4l5 6h-5"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-7 3 3v4M12 14l1-5.5-4 2V13M13 8.5l2 3.5h3"/>',
  other: '<circle cx="12" cy="12" r="3"/>',
};

const OPEN =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

/** The icon as SVG markup, for the map's DOM markers. */
export function legIconMarkup(mode: LegMode): string {
  return `${OPEN}${SHAPES[mode]}</svg>`;
}

/** The icon for React views. */
export function LegIcon({ mode, className }: { mode: LegMode; className?: string }) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-flex', verticalAlign: '-2px' }}
      dangerouslySetInnerHTML={{ __html: legIconMarkup(mode) }}
    />
  );
}
