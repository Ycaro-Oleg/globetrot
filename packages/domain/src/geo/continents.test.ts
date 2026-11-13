import { describe, expect, it } from 'vitest';
import { listCountryCodes } from './countries';
import { CONTINENTS, continentOf } from './continents';

describe('continentOf', () => {
  it('places well-known countries', () => {
    expect(continentOf('JP')).toBe('asia');
    expect(continentOf('PT')).toBe('europe');
    expect(continentOf('br')).toBe('south-america');
    expect(continentOf('MX')).toBe('north-america');
    expect(continentOf('NZ')).toBe('oceania');
    expect(continentOf('EG')).toBe('africa');
    expect(continentOf('ZZ')).toBeNull();
  });

  it('knows every country the platform lists, once', () => {
    const missing = listCountryCodes().filter((code) => continentOf(code) === null);
    expect(missing).toEqual([]);
    expect(CONTINENTS).toHaveLength(7);
  });
});
