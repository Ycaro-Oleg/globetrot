import { destinationBySlug, SUGGESTED_DESTINATIONS } from '@globetrot/domain';
import { notFound } from 'next/navigation';
import { Itinerary, itineraryMetadata, pickedCurrency } from '../../_itinerary/itinerary';

type Props = {
  params: Promise<{ destination: string }>;
  searchParams: Promise<{ currency?: string }>;
};

export function generateStaticParams() {
  return SUGGESTED_DESTINATIONS.map((destination) => ({ destination: destination.slug }));
}

export async function generateMetadata({ params }: Props) {
  const destination = destinationBySlug((await params).destination, 'en');
  return destination ? itineraryMetadata(destination, 'en') : {};
}

/** A public itinerary in English (ADR-0028). */
export default async function ItineraryPage({ params, searchParams }: Props) {
  const destination = destinationBySlug((await params).destination, 'en');
  if (!destination) notFound();
  const currency = pickedCurrency((await searchParams).currency);
  return <Itinerary destination={destination} language="en" currency={currency} />;
}
