import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { SITE_NAME } from './site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

/** The picture a shared link shows: the brand, the headline in the visitor's language, and an airmail route. */
export default async function OpengraphImage() {
  const t = await getTranslations('landing');
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#fff5e1',
        color: '#1d1a35',
        border: '24px solid #2b45c4',
      }}
    >
      <div style={{ display: 'flex', fontSize: 44, fontWeight: 800 }}>{SITE_NAME}</div>
      <div
        style={{ display: 'flex', fontSize: 76, fontWeight: 800, lineHeight: 1.05, maxWidth: 960 }}
      >
        {t('metaHeadline')}
      </div>
      <svg width="1000" height="90" viewBox="0 0 1000 90">
        <path
          d="M10 70 Q 260 0 500 45 T 990 30"
          fill="none"
          stroke="#c0301a"
          strokeWidth="8"
          strokeDasharray="22 14"
        />
        <circle cx="10" cy="70" r="14" fill="#f5b31c" stroke="#1d1a35" strokeWidth="5" />
        <circle cx="990" cy="30" r="14" fill="#f5b31c" stroke="#1d1a35" strokeWidth="5" />
      </svg>
    </div>,
    size,
  );
}
