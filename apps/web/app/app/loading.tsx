import { useTranslations } from 'next-intl';

/** Shown inside the shell while a signed-in page loads. */
export default function Loading() {
  const t = useTranslations('shell');
  return <p role="status">{t('loading')}</p>;
}
