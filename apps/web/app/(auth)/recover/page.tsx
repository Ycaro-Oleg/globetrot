import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from '../../site';
import { RecoverForm } from '../_components/recover-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth');
  return { title: `${t('recover.title')} · ${SITE_NAME}` };
}

export default function RecoverPage() {
  return <RecoverForm />;
}
