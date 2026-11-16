import { ImageResponse } from 'next/og';
import { getLocale, getTranslations } from 'next-intl/server';
import { arcPath, routeSketch } from '../../../lib/route-sketch';
import { fetchSharedTrip, formatMonth } from '../../../lib/shared-trip';
import { SITE_NAME } from '../../site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = SITE_NAME;

/** The card a shared trip shows on Twitter and in chats: the title, the route drawn, the month and the answer. */
export default async function SharedTripImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // The card speaks the owner's language, like the title they wrote: crawlers have no language of their own.
  const trip = await fetchSharedTrip(slug);
  const locale = trip?.locale ?? (await getLocale());
  const t = await getTranslations({ locale, namespace: 'sharedTrip' });
  const points = trip ? routeSketch(trip.stops, 460, 420, 50) : [];
  const names = trip ? trip.stops.map((stop) => stop.name) : [];
  // One stop named like the trip would say the same word twice.
  const route = names.length === 1 && names[0] === trip?.title ? '' : names.join(' → ');
  const line = trip
    ? [
        trip.startMonth ? formatMonth(trip.startMonth, locale) : null,
        t('ogNights', { nights: trip.totalNights }),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const ready =
    trip && trip.savings.status === 'saving' && trip.savings.readyMonth
      ? t('ogReady', { month: formatMonth(trip.savings.readyMonth, locale) })
      : trip && trip.savings.status === 'fully-saved'
        ? t('saved')
        : null;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#0f172a',
        color: '#f8fafc',
        padding: 56,
        gap: 40,
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
        <div style={{ display: 'flex', fontSize: 34, fontWeight: 800, color: '#fb923c' }}>
          {SITE_NAME.toLowerCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            {trip?.title ?? SITE_NAME}
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#cbd5e1' }}>{route}</div>
          <div style={{ display: 'flex', fontSize: 30, color: '#cbd5e1' }}>{line}</div>
        </div>
        {ready ? (
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              padding: '14px 26px',
              borderRadius: 999,
              background: '#fb923c',
              color: '#0f172a',
              fontSize: 32,
              fontWeight: 800,
            }}
          >
            {ready}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
      </div>
      <div
        style={{
          display: 'flex',
          width: 460,
          height: 518,
          borderRadius: 32,
          background: '#1e3a8a',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="460" height="420" viewBox="0 0 460 420">
          {Array.from({ length: 22 * 20 }, (_, n) => (
            <circle
              key={`d${n}`}
              cx={(n % 22) * 21 + 10}
              cy={Math.floor(n / 22) * 21 + 10}
              r="2"
              fill="#3b5bdb"
            />
          ))}
          {points.slice(1).map((point, index) => (
            <path
              key={`a${index}`}
              d={arcPath(points[index]!, point)}
              fill="none"
              stroke="#f87171"
              strokeWidth="6"
              strokeDasharray="16 12"
            />
          ))}
          {points.map((point, index) => (
            <circle
              key={`p${index}`}
              cx={point.x}
              cy={point.y}
              r="16"
              fill="#fbbf24"
              stroke="#0f172a"
              strokeWidth="5"
            />
          ))}
        </svg>
      </div>
    </div>,
    size,
  );
}
