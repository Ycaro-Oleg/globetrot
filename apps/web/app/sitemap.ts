import type { MetadataRoute } from 'next';
import { siteOrigin } from '../lib/site-url';

/** The public pages. The language is a cookie on the same URL, so each page is listed once. */
export const PUBLIC_PATHS = ['/', '/signup', '/login', '/terms', '/privacy'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : 0.5,
  }));
}
