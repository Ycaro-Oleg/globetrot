import { ImageResponse } from 'next/og';
import { BrandMark } from './brand-mark';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** The icon an iPhone uses when the app is added to the home screen. */
export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} padding={10} />, size);
}
