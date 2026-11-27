import { formatMoney, type SuggestedDestination } from '@globetrot/domain';
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { BrandLockup } from '../brand-mark';
import { SITE_NAME } from '../site';
import { referencePlan, type ItineraryLanguage } from './itinerary';

/** The link preview of an itinerary: the destination, the route and the typical cost per person. */
export async function itineraryImage(
  destination: SuggestedDestination | null,
  language: ItineraryLanguage,
) {
  const locale = language === 'pt' ? 'pt-BR' : 'en';
  const t = await getTranslations({ locale, namespace: 'itinerary' });
  const plan = destination ? referencePlan(destination, 'budget') : null;
  const pt = language === 'pt';
  const title = destination
    ? t('title', { destination: pt ? destination.namePt : destination.name, days: plan!.days })
    : SITE_NAME;
  const route = plan
    ? plan.stops.map(({ stop }) => (pt ? stop.namePt : stop.name)).join(' → ')
    : '';
  const cost = plan
    ? `${formatMoney(plan.estimate.low, locale, { precision: 'whole' })}–${formatMoney(plan.estimate.high, locale, { precision: 'whole' })}`
    : '';
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#ffffff',
        color: '#1c1c1e',
        fontFamily: 'sans-serif',
      }}
    >
      <BrandLockup fontSize={32} color="#1c1c1e" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', fontSize: 66, fontWeight: 800, lineHeight: 1.05 }}>
          {title}
        </div>
        <div style={{ display: 'flex', fontSize: 32, color: '#4f545a' }}>{route}</div>
      </div>
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>
        {cost ? t('imageCost', { cost }) : ''}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
