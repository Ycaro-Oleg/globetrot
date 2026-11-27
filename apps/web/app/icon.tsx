import { ImageResponse } from 'next/og';
import { BrandMark } from './brand-mark';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/** The browser tab's icon. */
export default function Icon() {
  return new ImageResponse(<BrandMark size={64} tile={false} />, size);
}
