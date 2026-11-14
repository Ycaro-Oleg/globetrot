import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { fetchSharedTrip } from '../../../lib/shared-trip';
import { SITE_NAME } from '../../site';
import { SharedTripView } from './shared-trip-view';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [trip, t] = await Promise.all([fetchSharedTrip(slug), getTranslations('sharedTrip')]);
  if (!trip) return { title: SITE_NAME, robots: { index: false } };
  const description = t('metaDescription', { title: trip.title, nights: trip.totalNights });
  return {
    title: `${trip.title} · ${SITE_NAME}`,
    description,
    // Shared by a person, for the people they send it to: never listed by search engines.
    robots: { index: false, follow: false },
    openGraph: { title: trip.title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title: trip.title, description },
  };
}

/** A trip someone shared: the route, the month, the answer, and the way to plan your own. */
export default async function SharedTripPage({ params }: Props) {
  const { slug } = await params;
  const [trip, locale] = await Promise.all([fetchSharedTrip(slug), getLocale()]);
  if (!trip) notFound();
  return <SharedTripView trip={trip} locale={locale} />;
}
