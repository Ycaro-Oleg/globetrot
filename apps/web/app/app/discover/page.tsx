import { getTranslations } from 'next-intl/server';
import { isCommunityEnabled } from '../../../lib/flags';
import { DiscoverView } from './discover-view';

export async function generateMetadata() {
  const t = await getTranslations('discoverPage');
  return { title: t('title') };
}

/** Discover: ready plans that become a trip in one tap, and the community when it is on. */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <DiscoverView communityEnabled={isCommunityEnabled()} failed={status === 'error'} />;
}
