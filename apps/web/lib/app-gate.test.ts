import { describe, expect, it } from 'vitest';
import { isAppPath, loginRedirect } from './app-gate';

describe('app gate', () => {
  it('knows which paths are the app', () => {
    expect(isAppPath('/app')).toBe(true);
    expect(isAppPath('/app/trips/1')).toBe(true);
    expect(isAppPath('/apple')).toBe(false);
    expect(isAppPath('/login')).toBe(false);
    expect(isAppPath('/')).toBe(false);
  });

  it('sends an anonymous visitor to log in, remembering where they were going', () => {
    expect(loginRedirect('/app')).toBe('/login?next=%2Fapp');
    expect(loginRedirect('/app/trips/1', '?tab=budget')).toBe(
      '/login?next=%2Fapp%2Ftrips%2F1%3Ftab%3Dbudget',
    );
  });

  it('never carries a path that leaves the site', () => {
    // These cannot reach the gate through a real URL, but the helper must be safe on its own.
    expect(loginRedirect('//evil.example/app')).toBe('/login?next=%2Fapp');
    expect(loginRedirect('/\\evil.example')).toBe('/login?next=%2Fapp');
  });
});
