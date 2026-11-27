import { formatMoney, money, TRIAL_TERMS } from '@globetrot/domain';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getLocale, getTranslations } from 'next-intl/server';
import { BrandLockup } from './brand-mark';
import { SITE_NAME } from './site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

/** Three stops of an illustrative route across the card's dotted map. */
const STOPS = [
  { x: 70, y: 250 },
  { x: 205, y: 120 },
  { x: 350, y: 205 },
] as const;
const arc = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  `M${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${Math.min(a.y, b.y) - 70} ${b.x} ${b.y}`;

/**
 * The card the landing shows on X and in chats: the brand, the promise, the free week, and the product's answer
 * ("can I go?") on a dotted map with a route. Same colours as the app (handoff v2).
 */
export default async function OpengraphImage() {
  // The brand face (OFL), as WOFF: the image renderer cannot read the WOFF2 files the pages use.
  const font = (file: string) => readFile(join(process.cwd(), 'assets/og', file));
  const [extraBold, semiBold] = await Promise.all([
    font('bricolage-grotesque-latin-800-normal.woff'),
    font('bricolage-grotesque-latin-600-normal.woff'),
  ]);
  const locale = await getLocale();
  const t = await getTranslations('landing');
  const [line1, line2] = t.raw('heroTitle').replace('</accent>', '').split('<accent>') as [
    string,
    string,
  ];
  const monthly = formatMoney(money(30000n, 'USD'), locale, { precision: 'whole' });

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        padding: 64,
        gap: 40,
        color: '#1c1c1e',
        fontFamily: 'Bricolage Grotesque',
        background: 'radial-gradient(circle at 30% 0%, #ffffff 0%, #f3f4f5 62%)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
        }}
      >
        <BrandLockup fontSize={38} color="#1c1c1e" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 54,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
            }}
          >
            {line1.trim()}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 54,
              fontWeight: 800,
              lineHeight: 1.04,
              letterSpacing: -2,
              color: '#d63f24',
            }}
          >
            {line2.trim()}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '14px 28px',
            borderRadius: 999,
            background: '#d63f24',
            color: '#ffffff',
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          {t('ogTrial', { days: TRIAL_TERMS.days })}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: 392,
          borderRadius: 32,
          background: '#f3f4f5',
          border: '2px solid #e4e6e9',
          padding: 20,
        }}
      >
        <svg width="352" height="300" viewBox="0 0 380 300">
          {Array.from({ length: 19 * 15 }, (_, n) => (
            <circle
              key={`d${n}`}
              cx={(n % 19) * 20 + 10}
              cy={Math.floor(n / 19) * 20 + 10}
              r="2"
              fill="#c7cbd1"
            />
          ))}
          {STOPS.slice(1).map((stop, index) => (
            <path
              key={`a${index}`}
              d={arc(STOPS[index]!, stop)}
              fill="none"
              stroke="#d63f24"
              strokeWidth="6"
              strokeDasharray="16 12"
            />
          ))}
          {STOPS.map((stop, index) => (
            <circle
              key={`p${index}`}
              cx={stop.x}
              cy={stop.y}
              r="16"
              fill="#f59e0b"
              stroke="#111111"
              strokeWidth="5"
            />
          ))}
        </svg>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '18px 22px',
            borderRadius: 22,
            background: '#f3f4f5',
            color: '#1c1c1e',
          }}
        >
          <div style={{ display: 'flex', fontSize: 22, color: '#4f545a', fontWeight: 600 }}>
            {t('ogQuestion')}
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1.15,
            }}
          >
            <span style={{ color: '#15803d', marginRight: 8 }}>{t('ogYes')}</span>
            <span>{t('ogAnswer', { count: 9, monthly })}</span>
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Bricolage Grotesque', data: extraBold, weight: 800, style: 'normal' },
        { name: 'Bricolage Grotesque', data: semiBold, weight: 600, style: 'normal' },
      ],
    },
  );
}
