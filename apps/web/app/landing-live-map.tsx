'use client';

import {
  distanceKm,
  suggestPlan,
  SUGGESTED_DESTINATIONS,
  type LegMode,
  type SuggestedPlan,
} from '@globetrot/domain';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { RouteStop, StopSpot } from './app/board/board-route';
import styles from './landing.module.css';
import { onPlan, type LandingPlanChoice } from './landing-plan';

const WorldMapBoard = dynamic(
  () => import('./app/board/world-map').then((module) => module.WorldMapBoard),
  { ssr: false },
);

/** The demo's photos (Wikimedia Commons), with the facts their licences ask us to show. */
const PHOTOS = {
  sensoji: { file: 'tokyo-sensoji', author: 'Akonnchiroll', licence: 'CC0' },
  shibuya: { file: 'tokyo-shibuya', author: 'Syced', licence: 'CC0' },
  torii: { file: 'hakone-torii', author: 'Guilhem Vellut', licence: 'CC BY 2.0' },
  fushimi: { file: 'kyoto-fushimi', author: 'Balon Greyjoy', licence: 'CC0' },
  kiyomizu: { file: 'kyoto-kiyomizu', author: 'Martin Falbisoner', licence: 'CC BY-SA 4.0' },
  dotonbori: { file: 'osaka-dotonbori', author: 'Sakai Yayoi', licence: 'CC0' },
} as const;
type PhotoKey = keyof typeof PHOTOS;

const SOURCES: Record<PhotoKey, string> = {
  sensoji: 'https://commons.wikimedia.org/wiki/File:Sensoji_2023.jpg',
  shibuya: 'https://commons.wikimedia.org/wiki/File:Shibuya_crossing_(12214).jpg',
  torii:
    'https://commons.wikimedia.org/wiki/File:Torii_on_Lake_Ashi_@_Hakone_Shrine_(13776878594).jpg',
  fushimi: 'https://commons.wikimedia.org/wiki/File:20181110_Fushimi_Inari_Torii_12.jpg',
  kiyomizu: 'https://commons.wikimedia.org/wiki/File:Kiyomizu-dera,_Kyoto,_November_2016_-01.jpg',
  dotonbori: 'https://commons.wikimedia.org/wiki/File:Osaka_Dotonbori_yoru.jpg',
};

type Spot = readonly [name: string, longitude: number, latitude: number, kind: StopSpot['kind']];

/** A spring trip through Japan that uses everything a stop can hold. Place names are proper nouns. */
const TRIP: readonly {
  key: 'tokyo' | 'hakone' | 'kyoto' | 'osaka';
  region: string;
  longitude: number;
  latitude: number;
  nights: number;
  leg: LegMode | null;
  spotRoute: boolean;
  spots: readonly Spot[];
  photos: readonly PhotoKey[];
  todos: readonly (readonly [key: string, done: boolean])[];
}[] = [
  {
    key: 'tokyo',
    region: 'Tokyo',
    longitude: 139.7671,
    latitude: 35.6812,
    nights: 4,
    leg: 'train',
    spotRoute: true,
    spots: [
      ['Tokyo Station Hotel', 139.765, 35.68, 'stay'],
      ['Tsukiji Outer Market', 139.7708, 35.6654, 'food'],
      ['Nakamise-dori', 139.7963, 35.7118, 'shop'],
      ['Senso-ji', 139.7967, 35.7148, 'sight'],
      ['Shibuya Crossing', 139.7005, 35.6595, 'sight'],
    ],
    photos: ['sensoji', 'shibuya'],
    todos: [
      ['tokyoTodo1', true],
      ['tokyoTodo2', false],
    ],
  },
  {
    key: 'hakone',
    region: 'Kanagawa',
    longitude: 139.1069,
    latitude: 35.2324,
    nights: 1,
    leg: 'train',
    spotRoute: false,
    spots: [
      ['Hakone-Yumoto Station', 139.1035, 35.2323, 'transport'],
      ['Gora Kadan', 139.0475, 35.2478, 'stay'],
      ['Hakone Open-Air Museum', 139.0517, 35.2449, 'sight'],
      ['Lake Ashi', 139.0235, 35.2045, 'sight'],
    ],
    photos: ['torii'],
    todos: [['hakoneTodo1', false]],
  },
  {
    key: 'kyoto',
    region: 'Kyoto',
    longitude: 135.7588,
    latitude: 34.9858,
    nights: 4,
    leg: 'train',
    spotRoute: true,
    spots: [
      ['Kyoto Station', 135.7588, 34.9858, 'transport'],
      ['Fushimi Inari', 135.7727, 34.9671, 'sight'],
      ['Kiyomizu-dera', 135.785, 34.9949, 'sight'],
      ['Gion', 135.7752, 35.0037, 'sight'],
      ['Nishiki Market', 135.765, 35.005, 'food'],
    ],
    photos: ['fushimi', 'kiyomizu'],
    todos: [
      ['kyotoTodo1', false],
      ['kyotoTodo2', false],
    ],
  },
  {
    key: 'osaka',
    region: 'Osaka',
    longitude: 135.4959,
    latitude: 34.7025,
    nights: 2,
    leg: null,
    spotRoute: false,
    spots: [
      ['Shin-Osaka Station', 135.5003, 34.7334, 'transport'],
      ['Kuromon Market', 135.5066, 34.6655, 'food'],
      ['Dotonbori', 135.5013, 34.6687, 'food'],
      ['Osaka Castle', 135.5262, 34.6873, 'sight'],
    ],
    photos: ['dotonbori'],
    todos: [['osakaTodo1', false]],
  },
];

const ALT: Record<PhotoKey, string> = {
  sensoji: 'altSensoji',
  shibuya: 'altShibuya',
  torii: 'altTorii',
  fushimi: 'altFushimi',
  kiyomizu: 'altKiyomizu',
  dotonbori: 'altDotonbori',
};

/**
 * The real map board on the landing, with a finished trip to explore: pins with photos, notes and to-dos,
 * typed places inside each city and their A→B→C route, the legs, the folding panel. It loads only when the
 * section comes into view (the map and its tiles are heavy) and nothing in it is saved.
 */
export function LandingLiveMap() {
  const t = useTranslations('landing.liveDemo');
  const suggest = useTranslations('landing.suggest');
  const why = useTranslations('suggest.why');
  const places = useTranslations('mapBoard.places');
  const pt = useLocale().startsWith('pt');
  const [choice, setChoice] = useState<LandingPlanChoice | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The plan built above, once there is one: the map shows that trip instead of the example.
  useEffect(() => onPlan(setChoice), []);

  const photosOf = (key: string): RouteStop['photos'] =>
    (TRIP.find((stop) => stop.key === key)?.photos ?? []).map((photo) => ({
      mediaId: `demo-${photo}`,
      alt: t(ALT[photo]),
      src: `/demo/${PHOTOS[photo].file}.webp`,
      credit: `${PHOTOS[photo].author} · ${PHOTOS[photo].licence}`,
    }));

  const plan = choice ? suggestPlan(choice) : null;
  const example: RouteStop[] = TRIP.map((stop) => ({
    id: `demo:${stop.key}`,
    name: places(stop.key),
    countryCode: 'JP',
    region: stop.region,
    longitude: stop.longitude,
    latitude: stop.latitude,
    nights: stop.nights,
    note: t(`${stop.key}Note`),
    legMode: stop.leg,
    visited: false,
    spotRoute: stop.spotRoute,
    spots: stop.spots.map(([name, longitude, latitude, kind]) => ({
      name,
      kind,
      longitude,
      latitude,
      done: false,
    })),
    todos: stop.todos.map(([key, done]) => ({ text: t(key), done })),
    photos: stop.photos.map((key) => ({
      mediaId: `demo-${key}`,
      alt: t(ALT[key]),
      src: `/demo/${PHOTOS[key].file}.webp`,
      credit: `${PHOTOS[key].author} · ${PHOTOS[key].licence}`,
    })),
  }));

  const route = plan ? planRoute(plan) : example;
  const destination = plan
    ? SUGGESTED_DESTINATIONS.find((candidate) => candidate.id === plan.destination)
    : null;
  const title = destination
    ? suggest('planTitle', {
        destination: pt ? destination.namePt : destination.name,
        days: plan!.days,
      })
    : t('title');

  /** The plan as the app's board holds it: a stop per city, its experiences as places, the way on. */
  function planRoute(built: SuggestedPlan): RouteStop[] {
    return built.stops.map(({ stop, nights, experiences, next }) => ({
      id: `plan:${stop.key}`,
      name: pt ? stop.namePt : stop.name,
      countryCode: stop.countryCode,
      region: stop.region,
      longitude: stop.longitude,
      latitude: stop.latitude,
      nights,
      note: experiences
        .map((experience) => `${pt ? experience.namePt : experience.name}: ${why(experience.id)}`)
        .join('\n'),
      legMode: next?.mode ?? null,
      visited: false,
      // The A→B→C route only when every place is in town (a day trip far away would stretch it).
      spotRoute:
        experiences.length > 1 &&
        experiences.every((experience) => distanceKm(stop, experience) < 60),
      spots: experiences.map((experience) => ({
        name: pt ? experience.namePt : experience.name,
        kind: experience.kind,
        latitude: experience.latitude,
        longitude: experience.longitude,
        done: false,
      })),
      todos: [],
      photos: photosOf(stop.key),
    }));
  }

  return (
    <div className={styles.liveMap}>
      {plan ? (
        <p className={styles.liveMapYours}>
          <span>{t('yours')}</span>
          <button type="button" onClick={() => setChoice(null)}>
            {t('backToExample')}
          </button>
        </p>
      ) : null}
      <div ref={box} className={styles.liveMapBox} role="region" aria-label={t('map')}>
        {visible ? (
          <WorldMapBoard
            key={
              plan
                ? `${plan.destination}-${plan.days}-${choice!.likes.join('.')}-${choice!.comfort}`
                : 'example'
            }
            demo
            tripId={null}
            tripTitle={title}
            startDate={null}
            initialRoute={route}
            initialVisas={[]}
          />
        ) : (
          <p className={styles.liveMapLoading}>{t('loading')}</p>
        )}
      </div>
      <p className={styles.liveMapCredits}>
        {t('credits')}{' '}
        {(Object.keys(PHOTOS) as PhotoKey[]).map((key, index) => (
          <span key={key}>
            {index > 0 ? ' · ' : ''}
            <a href={SOURCES[key]} rel="noopener noreferrer" target="_blank">
              {PHOTOS[key].author}
            </a>{' '}
            ({PHOTOS[key].licence})
          </span>
        ))}
      </p>
    </div>
  );
}
