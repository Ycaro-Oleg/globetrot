import { headers } from 'next/headers';

/**
 * The public origin of this request, for absolute links in metadata, `robots.txt` and the sitemap. It is read from
 * the request (the edge sets `x-forwarded-*`), so one image serves every environment without another setting.
 */
export async function siteOrigin(): Promise<URL> {
  const list = await headers();
  const host = list.get('x-forwarded-host') ?? list.get('host') ?? 'localhost:3000';
  const proto = list.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  // Only a plain host name (and port) is accepted, so a forged header cannot inject a path or a scheme.
  const safeHost = /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? host : 'localhost:3000';
  return new URL(`${proto === 'http' ? 'http' : 'https'}://${safeHost}`);
}
