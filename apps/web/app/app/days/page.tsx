import { redirect } from 'next/navigation';

/** The days now live in the trip's document, under "Itinerary"; old links and bookmarks land there. */
export default function DaysPage() {
  redirect('/app/trip#itinerary');
}
