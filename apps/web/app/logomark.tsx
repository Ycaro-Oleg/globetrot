import { BRAND_MARK_ON_DARK_SRC, BRAND_MARK_SRC } from './brand-mark-svg';

/**
 * Globetrot's mark beside the wordmark (TopBar, landing, sign-in, onboarding, shared trips). Decorative: the link's
 * text names it. `onDark` adds a white halo so the ink outline still reads on a dark background.
 */
export function Logomark({
  className,
  size = 28,
  onDark = false,
}: {
  className?: string | undefined;
  size?: number;
  onDark?: boolean;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- an inline data URI, nothing for next/image to optimise
    <img
      src={onDark ? BRAND_MARK_ON_DARK_SRC : BRAND_MARK_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    />
  );
}
