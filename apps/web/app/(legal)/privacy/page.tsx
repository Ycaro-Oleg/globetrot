import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '../../site';
import { DraftPage } from '../draft-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal');
  return { title: `${t('privacyTitle')} · ${SITE_NAME}`, robots: { index: false } };
}

export default function PrivacyPage() {
  return <DraftPage title="privacyTitle" />;
}
