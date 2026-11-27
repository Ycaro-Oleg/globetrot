import type { MetadataRoute } from 'next';
import { SUGGESTED_DESTINATIONS } from '@globetrot/domain';
import { siteOrigin } from '../lib/site-url';
import { itineraryPath } from './_itinerary/itinerary';

/** The public pages. The language is a cookie on the same URL, so each page is listed once. */
export const PUBLIC_PATHS = ['/', '/signup', '/login', '/terms', '/privacy'] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await siteOrigin();
  const pages = PUBLIC_PATHS.map((path) => ({
    url: new URL(path, origin).toString(),
    changeFrequency: path === '/' ? ('weekly' as const) : ('monthly' as const),
    priority: path === '/' ? 1 : 0.5,
  }));
  // The public itineraries, in both languages (ADR-0028).
  const itineraries = SUGGESTED_DESTINATIONS.flatMap((destination) =>
    (['pt', 'en'] as const).map((language) => ({
      url: new URL(itineraryPath(destination, language), origin).toString(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  );
  return [...pages, ...itineraries];
}
