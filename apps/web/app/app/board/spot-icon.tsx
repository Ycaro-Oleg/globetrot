import type { SpotKind } from '@globetrot/domain';

/**
 * Each kind of place as a small line drawing, like the leg icons: emoji show as empty boxes on some systems.
 * Constant markup only: the map's mini-pins set it as HTML, the pin card renders it.
 */
const SHAPES: Record<SpotKind, string> = {
  stay: '<path d="M3 18V7M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="2"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10"/>',
  sight:
    '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  shop: '<path d="M5 8h14l-1 13H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  transport:
    '<rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 1.5M15 20l2 1.5M9.5 13h.01M14.5 13h.01"/>',
  other: '<path d="M12 4v16M4 12h16M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
};

const OPEN =
  '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';

/** The icon as SVG markup, for the map's DOM markers. */
export function spotIconMarkup(kind: SpotKind): string {
  return `${OPEN}${SHAPES[kind]}</svg>`;
}

/** The icon for React views. */
export function SpotIcon({ kind, className }: { kind: SpotKind; className?: string }) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{ display: 'inline-flex', verticalAlign: '-0.125em' }}
      dangerouslySetInnerHTML={{ __html: spotIconMarkup(kind) }}
    />
  );
}
