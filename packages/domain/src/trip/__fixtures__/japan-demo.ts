/**
 * The prototype's "Ten days in Japan" demo board (design/reference/claude-design-v1/atlas/data.js,
 * `AT.demoJapan`), translated to the domain shape. Amounts stay in BRL, as in the prototype, so results can
 * be compared one-to-one with its screens: total R$ 13,700, "Almost… by April 2027", R$ 1,830/month, 4 of 9 stamps.
 */
import { fromDecimal } from '../../money';
import { toLocalDate } from '../../time';
import type { ChecklistItem, PlannedPlace, TripExpense, TripPlan } from '../types';

export const JAPAN_TODAY = toLocalDate('2026-11-07');

const brl = (amount: string) => fromDecimal(amount, 'BRL');
const place = (id: string, day: number | null, done = false): PlannedPlace => ({ id, day, done });
const expense = (
  id: string,
  category: TripExpense['category'],
  stopId: string | null,
  amount: string,
  status: TripExpense['status'] = 'estimate',
): TripExpense => ({ id, category, stopId, status, amount: brl(amount) });
const item = (id: string, group: ChecklistItem['group'], done = false): ChecklistItem => ({
  id,
  group,
  done,
});

export function japanDemo(): TripPlan {
  return {
    currency: brl('0').currency,
    startDate: toLocalDate('2027-04-03'),
    stops: [
      {
        id: 'tokyo',
        nights: 4,
        state: 'planned',
        places: [
          place('tsukiji', 2, true),
          place('sensoji', 1),
          place('yanaka', 3),
          place('shibuya', 1),
        ],
      },
      {
        id: 'hakone',
        nights: 1,
        state: 'planned',
        places: [place('onsen', 5), place('lakeashi', null)],
      },
      {
        id: 'kyoto',
        nights: 3,
        state: 'planned',
        places: [
          place('inari', 6, true),
          place('nishiki', 6, true),
          place('kiyomizu', 7),
          place('todaiji', null),
          place('pontocho', null),
        ],
      },
      { id: 'osaka', nights: 2, state: 'planned', places: [place('dotonbori', 9)] },
    ],
    expenses: [
      expense('flights', 'flights', null, '6200'),
      expense('stay-tokyo', 'stay', 'tokyo', '1180'),
      expense('stay-hakone', 'stay', 'hakone', '520'),
      expense('stay-kyoto', 'stay', 'kyoto', '1120', 'confirmed'),
      expense('transit', 'local_transport', null, '1250'),
      expense('food', 'food', null, '1800'),
      expense('entries', 'experiences', null, '850'),
      expense('insurance', 'insurance', null, '380', 'paid'),
      expense('buffer', 'buffer', null, '400'),
    ],
    checklist: [
      item('passport', 'documents'),
      item('visa-rules', 'documents'),
      item('buy-insurance', 'documents', true),
      item('tell-bank', 'money'),
      item('yen-cash', 'money'),
      item('fee-free-card', 'money', true),
      item('flights-booked', 'bookings'),
      item('kyoto-booked', 'bookings', true),
      item('hakone-booked', 'bookings'),
      item('adapter', 'packing'),
      item('shoes', 'packing', true),
      item('towel', 'packing'),
    ],
    savings: { saved: brl('6400'), monthly: brl('1500') },
  };
}

/** The Japan demo with every gap closed: beds, full itinerary, checklist done, fully saved. */
export function japanReady(): TripPlan {
  const trip = japanDemo();
  const fill = (id: string, day: number): PlannedPlace => place(`${id}-${day}`, day);
  return {
    ...trip,
    stops: trip.stops.map((s) =>
      s.id === 'tokyo'
        ? { ...s, places: [...s.places, fill('tokyo', 4)] }
        : s.id === 'kyoto'
          ? { ...s, places: [...s.places, fill('kyoto', 8)] }
          : s.id === 'osaka'
            ? { ...s, places: [...s.places, fill('osaka', 10)] }
            : s,
    ),
    expenses: [...trip.expenses, expense('stay-osaka', 'stay', 'osaka', '580')],
    checklist: trip.checklist.map((c) => ({ ...c, done: true })),
    savings: { saved: brl('14280'), monthly: brl('1500') },
  };
}
