/**
 * Partner links (ADR-0031): searches on partner sites for the places of a trip, carrying Globetrot's partner id.
 * They appear only when the id is configured, are always labelled as partner links, and never show a price:
 * prices come from the partner's own page.
 */
export interface Partners {
  readonly getYourGuide: string | null;
  readonly booking: string | null;
  /** Full URLs of the chosen insurance and eSIM partners, with their tracking already in them. */
  readonly insurance: string | null;
  readonly esim: string | null;
}

const env = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : null;
};

/** Read per request, so one image behaves differently in each environment. */
export function partnersFromEnv(): Partners {
  return {
    getYourGuide: env('GETYOURGUIDE_PARTNER_ID'),
    booking: env('BOOKING_AID'),
    insurance: safeUrl(env('PARTNER_INSURANCE_URL')),
    esim: safeUrl(env('PARTNER_ESIM_URL')),
  };
}

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/** Things to do in a place, on GetYourGuide. */
export function toursUrl(partners: Partners, place: string): string | null {
  if (!partners.getYourGuide) return null;
  const url = new URL('https://www.getyourguide.com/s/');
  url.searchParams.set('q', place);
  url.searchParams.set('partner_id', partners.getYourGuide);
  return url.toString();
}

/** Places to stay in a place, on Booking.com. */
export function staysUrl(partners: Partners, place: string): string | null {
  if (!partners.booking) return null;
  const url = new URL('https://www.booking.com/searchresults.html');
  url.searchParams.set('ss', place);
  url.searchParams.set('aid', partners.booking);
  return url.toString();
}

export const NO_PARTNERS: Partners = {
  getYourGuide: null,
  booking: null,
  insurance: null,
  esim: null,
};
