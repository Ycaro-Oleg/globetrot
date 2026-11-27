import { afterEach, describe, expect, it, vi } from 'vitest';
import { NO_PARTNERS, partnersFromEnv, staysUrl, toursUrl } from './partners';

afterEach(() => vi.unstubAllEnvs());

describe('partner links (ADR-0031)', () => {
  it('appear only with a configured id, carrying it and the place', () => {
    expect(toursUrl(NO_PARTNERS, 'Lisboa')).toBeNull();
    expect(staysUrl(NO_PARTNERS, 'Lisboa')).toBeNull();
    const partners = { ...NO_PARTNERS, getYourGuide: 'GYG1', booking: '123' };
    expect(toursUrl(partners, 'Lisboa')).toBe(
      'https://www.getyourguide.com/s/?q=Lisboa&partner_id=GYG1',
    );
    expect(staysUrl(partners, 'São Paulo')).toBe(
      'https://www.booking.com/searchresults.html?ss=S%C3%A3o+Paulo&aid=123',
    );
  });

  it('read the settings per request and accept only https partner pages', () => {
    vi.stubEnv('GETYOURGUIDE_PARTNER_ID', ' GYG1 ');
    vi.stubEnv('PARTNER_INSURANCE_URL', 'http://insecure.example/x');
    vi.stubEnv('PARTNER_ESIM_URL', 'https://esim.example/?ref=globetrot');
    expect(partnersFromEnv()).toEqual({
      getYourGuide: 'GYG1',
      booking: null,
      insurance: null,
      esim: 'https://esim.example/?ref=globetrot',
    });
  });
});
