import { destinationBySlug, SUGGESTED_DESTINATIONS } from '@globetrot/domain';
import { notFound } from 'next/navigation';
import { Itinerary, itineraryMetadata, pickedCurrency } from '../../_itinerary/itinerary';

type Props = {
  params: Promise<{ destino: string }>;
  searchParams: Promise<{ moeda?: string }>;
};

export function generateStaticParams() {
  return SUGGESTED_DESTINATIONS.map((destination) => ({ destino: destination.slugPt }));
}

export async function generateMetadata({ params }: Props) {
  const destination = destinationBySlug((await params).destino, 'pt');
  return destination ? itineraryMetadata(destination, 'pt') : {};
}

/** A public itinerary in Portuguese (ADR-0028). */
export default async function ItineraryPage({ params, searchParams }: Props) {
  const destination = destinationBySlug((await params).destino, 'pt');
  if (!destination) notFound();
  const currency = pickedCurrency((await searchParams).moeda);
  return <Itinerary destination={destination} language="pt" currency={currency} />;
}
