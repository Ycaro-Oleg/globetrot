import type { MetadataRoute } from 'next';
import { siteOrigin } from '../lib/site-url';

/** Public pages may be indexed; the signed-in app, the settings and the API may not. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await siteOrigin();
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/app', '/settings', '/api/', '/v1/'] },
    sitemap: new URL('/sitemap.xml', origin).toString(),
  };
}
