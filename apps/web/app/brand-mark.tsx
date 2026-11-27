/**
 * Globetrot's mark (the orange ring of the TopBar logo) drawn for `ImageResponse`: the favicon, the Apple touch
 * icon and the installable app's icons. `padding` leaves room for maskable icons, whose edges a launcher may crop.
 */
export function BrandMark({ size, padding = 0 }: { size: number; padding?: number }) {
  const ring = Math.round((size - padding * 2) * 0.62);
  const stroke = Math.max(2, Math.round(ring * 0.16));
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
      }}
    >
      <div
        style={{
          width: ring,
          height: ring,
          borderRadius: '50%',
          border: `${stroke}px solid #f97316`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: Math.round(ring * 0.42),
            height: Math.round(ring * 0.42),
            borderRadius: '50%',
            background: '#f97316',
          }}
        />
      </div>
    </div>
  );
}
