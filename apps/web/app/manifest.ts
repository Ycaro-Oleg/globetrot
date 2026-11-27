import type { MetadataRoute } from 'next';
import { SITE_NAME } from './site';

/** Lets people install Globetrot on a phone's home screen; it opens on their trip. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-icon/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
