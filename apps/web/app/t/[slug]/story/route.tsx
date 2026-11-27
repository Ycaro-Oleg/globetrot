import { formatMoney, fromDecimal, subtract } from '@globetrot/domain';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { fetchSharedTrip, formatMonth } from '../../../../lib/shared-trip';
import { BrandLockup } from '../../../brand-mark';

/**
 * The progress card for stories (1080×1920, ADR-0028), made from a trip's public link: the trip, how far the
 * saving is and the month it is ready. Amounts appear only when the owner chose to show them on the link.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const trip = await fetchSharedTrip(slug);
  if (!trip) return new Response('Not found', { status: 404 });
  const locale = trip.locale;
  const t = await getTranslations({ locale, namespace: 'sharedTrip' });
  const percent = Math.round(trip.savings.progressBasisPoints / 100);
  const left = trip.amounts
    ? subtract(
        fromDecimal(trip.amounts.total.amount, trip.amounts.total.currency),
        fromDecimal(trip.amounts.saved.amount, trip.amounts.saved.currency),
      )
    : null;
  const headline =
    trip.savings.status === 'fully-saved'
      ? t('story.ready')
      : left && left.amountMinor > 0n
        ? t('story.left', { amount: formatMoney(left, locale, { precision: 'whole' }) })
        : t('story.progress', { percent });
  const when = trip.savings.readyMonth
    ? t('story.month', { month: formatMonth(trip.savings.readyMonth, locale) })
    : trip.startMonth
      ? formatMonth(trip.startMonth, locale)
      : '';
  const route = trip.stops.map((stop) => stop.name).join(' → ');

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 96,
        background: 'linear-gradient(180deg, #ffffff 0%, #f3f4f5 70%)',
        color: '#1c1c1e',
        fontFamily: 'sans-serif',
      }}
    >
      <BrandLockup fontSize={44} color="#1c1c1e" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', fontSize: 104, fontWeight: 800, lineHeight: 1.02 }}>
          {trip.title}
        </div>
        <div style={{ display: 'flex', fontSize: 40, color: '#4f545a' }}>{route}</div>
        <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, color: '#d63f24' }}>
          {headline}
        </div>
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: 36,
            borderRadius: 18,
            background: 'rgba(17,17,17,0.1)',
          }}
        >
          <div
            style={{
              display: 'flex',
              width: `${Math.max(4, percent)}%`,
              height: 36,
              borderRadius: 18,
              background: '#d63f24',
            }}
          />
        </div>
        <div style={{ display: 'flex', fontSize: 44, fontWeight: 700 }}>{when}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 36, color: '#4f545a' }}>{t('story.footer')}</div>
    </div>,
    { width: 1080, height: 1920 },
  );
}
