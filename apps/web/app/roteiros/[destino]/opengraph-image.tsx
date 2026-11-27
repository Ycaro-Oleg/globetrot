import { destinationBySlug } from '@globetrot/domain';
import { itineraryImage } from '../../_itinerary/image';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Globetrot';

export default async function Image({ params }: { params: Promise<{ destino: string }> }) {
  return itineraryImage(destinationBySlug((await params).destino, 'pt'), 'pt');
}
