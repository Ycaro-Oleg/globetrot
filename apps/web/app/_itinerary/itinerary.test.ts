import { SUGGESTED_DESTINATIONS } from '@globetrot/domain';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/site-url', () => ({ siteOrigin: async () => 'https://globetrot.example' }));

import sitemap from '../sitemap';
import { itineraryPath, pickedCurrency, referencePlan } from './itinerary';

describe('public itineraries (ADR-0028)', () => {
  it('have an address in each language', () => {
    const japan = SUGGESTED_DESTINATIONS.find((destination) => destination.id === 'japan')!;
    expect(itineraryPath(japan, 'pt')).toBe('/roteiros/japao');
    expect(itineraryPath(japan, 'en')).toBe('/itineraries/japan');
  });

  it('show the reference plan with every stop, and cost more in comfort than on a budget', () => {
    for (const destination of SUGGESTED_DESTINATIONS) {
      const budget = referencePlan(destination, 'budget');
      const comfort = referencePlan(destination, 'comfort');
      expect(budget.stops.length).toBe(destination.stops.length);
      expect(comfort.estimate.middle.amountMinor).toBeGreaterThan(
        budget.estimate.middle.amountMinor,
      );
    }
  });

  it('show US dollars until the visitor picks another currency the plans can show', () => {
    expect(pickedCurrency(undefined)).toBe('USD');
    expect(pickedCurrency('BRL')).toBe('BRL');
    expect(pickedCurrency('XYZ')).toBe('USD');
  });

  it('are listed in the sitemap in both languages', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain('https://globetrot.example/roteiros/japao');
    expect(urls).toContain('https://globetrot.example/itineraries/argentina-and-uruguay');
  });
});
