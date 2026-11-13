import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { apiInternalUrl } from '../../../../../lib/api-proxy';
import { fetchPost } from '../../../../../lib/community';
import { sessionCookieHeader } from '../../../../../lib/stored-preferences';
import { fetchTrips, SELECTED_TRIP_COOKIE } from '../../../../../lib/trips';
import { PostPageView } from './post-page-view';

export async function generateMetadata() {
  const t = await getTranslations('communityPage.postPage');
  return { title: t('title') };
}

/** One post with its comments open: where a copied link leads. Someone who may not see it gets "not found". */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const [store, { id }] = await Promise.all([cookies(), params]);
  const cookieHeader = sessionCookieHeader(store.getAll());
  const options = cookieHeader ? { cookieHeader, apiUrl: apiInternalUrl() } : null;
  if (!options || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [post, trips] = await Promise.all([fetchPost(options, id), fetchTrips(options)]);
  if (!post) notFound();
  const savedId = store.get(SELECTED_TRIP_COOKIE)?.value;
  const current = trips?.find((trip) => trip.id === savedId) ?? trips?.[0] ?? null;
  return (
    <PostPageView
      post={post}
      currentTrip={current ? { id: current.id, title: current.title } : null}
    />
  );
}
