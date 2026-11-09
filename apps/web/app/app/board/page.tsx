import { getTranslations } from 'next-intl/server';
import { WorldMapBoard } from './world-map';

export async function generateMetadata() {
  const t = await getTranslations('mapBoard');
  return { title: t('title') };
}

export default function BoardPage() {
  return <WorldMapBoard />;
}
