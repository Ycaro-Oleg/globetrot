import { describe, expect, it } from 'vitest';
import { sharedTripUrl } from './share-url';

describe('sharedTripUrl', () => {
  it('names the language only when it is not the default', () => {
    expect(sharedTripUrl('https://g.example', 'abc', 'en')).toBe('https://g.example/t/abc');
    expect(sharedTripUrl('https://g.example', 'abc', 'pt-BR')).toBe(
      'https://g.example/t/abc?lang=pt-BR',
    );
  });
});
