import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { apiInternalUrl } from '../../../../../lib/api-proxy';
import { fetchPerson, fetchPersonPosts } from '../../../../../lib/community';
import { sessionCookieHeader } from '../../../../../lib/stored-preferences';
import { fetchTrips, SELECTED_TRIP_COOKIE } from '../../../../../lib/trips';
import { PersonView } from './person-view';

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  return { title: `@${(await params).handle}` };
}

/** A person's community page: their Pip, counts, follow and mute, and the posts the viewer may see. */
export default async function PersonPage({ params }: { params: Promise<{ handle: string }> }) {
  const [store, { handle: raw }] = await Promise.all([cookies(), params]);
  const handle = decodeURIComponent(raw).toLowerCase();
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  if (!options) notFound();
  const [person, posts, trips] = await Promise.all([
    fetchPerson(options, handle),
    fetchPersonPosts(options, handle),
    fetchTrips(options),
  ]);
  if (!person || !posts) notFound();
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const current = trips?.find((trip) => trip.id === savedId) ?? trips?.[0] ?? null;
  return (
    <PersonView
      page={person}
      posts={posts}
      currentTrip={current ? { id: current.id, title: current.title } : null}
    />
  );
}
