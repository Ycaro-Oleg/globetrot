import { BRAND_MARK_SRC } from './brand-mark-svg';
import { SITE_NAME } from './site';

/**
 * Globetrot's mark on a white tile, drawn for `ImageResponse`: the favicon, the Apple touch icon and the installable
 * app's icons. `padding` leaves room for maskable icons, whose edges a launcher may crop. `tile: false` drops the
 * background, for the browser tab where the mark should sit on the tab's own colour.
 */
export function BrandMark({
  size,
  padding = 0,
  tile = true,
}: {
  size: number;
  padding?: number;
  tile?: boolean;
}) {
  const mark = Math.round((size - padding * 2) * (tile ? 0.84 : 1));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tile ? '#FFFFFF' : 'transparent',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements, not next/image */}
      <img src={BRAND_MARK_SRC} width={mark} height={mark} alt="" />
    </div>
  );
}

/** The mark and the name side by side, for the share images (light backgrounds, white palette). */
export function BrandLockup({ fontSize, color }: { fontSize: number; color: string }) {
  const mark = Math.round(fontSize * 1.35);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.round(fontSize * 0.35) }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain elements, not next/image */}
      <img src={BRAND_MARK_SRC} width={mark} height={mark} alt="" />
      <div style={{ display: 'flex', fontSize, fontWeight: 800, letterSpacing: -1, color }}>
        {SITE_NAME}
      </div>
    </div>
  );
}
