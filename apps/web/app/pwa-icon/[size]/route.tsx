import { ImageResponse } from 'next/og';
import { BrandMark } from '../../brand-mark';

const SIZES = { '192': 192, '512': 512, maskable: 512 } as const;

/** The installable app's icons (see `manifest.ts`); `maskable` keeps the mark inside the launcher's safe zone. */
export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const pixels = SIZES[size as keyof typeof SIZES];
  if (!pixels) return new Response('Not found', { status: 404 });
  return new ImageResponse(
    <BrandMark size={pixels} padding={size === 'maskable' ? Math.round(pixels * 0.12) : 0} />,
    { width: pixels, height: pixels, headers: { 'cache-control': 'public, max-age=86400' } },
  );
}

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}
