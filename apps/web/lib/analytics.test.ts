import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminCheckNeeded,
  EVENTS_COOKIE,
  firstTime,
  flushPendingEvents,
  internalParam,
  isExcluded,
  isInternal,
  parsePendingEvents,
  prepareEvent,
  queueEvents,
  readVisitOrigin,
  rememberAdminCheck,
  rememberVisitOrigin,
  setInternal,
  track,
  visitOrigin,
  type KeyValueStore,
} from './analytics';

function memoryStore(): KeyValueStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, String(value)),
    removeItem: (key) => void values.delete(key),
  };
}

describe('the internal mark', () => {
  it('reads ?interno=1 as mark, ?interno=0 as clear, anything else as nothing', () => {
    expect(internalParam('?interno=1')).toBe(true);
    expect(internalParam('?utm_source=x&interno=0')).toBe(false);
    expect(internalParam('?interno=yes')).toBeNull();
    expect(internalParam('')).toBeNull();
  });

  it('is kept on the device, with Plausible told to skip it too, until cleared', () => {
    const store = memoryStore();
    expect(isInternal(store)).toBe(false);
    setInternal(true, store);
    expect(isInternal(store)).toBe(true);
    expect(store.values.get('plausible_ignore')).toBe('true');
    setInternal(false, store);
    expect(isInternal(store)).toBe(false);
    expect(store.values.has('plausible_ignore')).toBe(false);
  });

  it('excludes the page that sets the mark before it is written, and lets ?interno=0 through at once', () => {
    const store = memoryStore();
    expect(isExcluded('?interno=1', store)).toBe(true);
    setInternal(true, store);
    expect(isExcluded('', store)).toBe(true);
    expect(isExcluded('?interno=0', store)).toBe(false);
  });

  it('treats storage that throws as not marked', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(isInternal(broken)).toBe(false);
  });
});

describe('asking whether the account is an admin', () => {
  it('asks once per account in a tab', () => {
    const store = memoryStore();
    expect(adminCheckNeeded('account-a', store)).toBe(true);
    rememberAdminCheck('account-a', store);
    expect(adminCheckNeeded('account-a', store)).toBe(false);
  });

  it('asks again when another account signs in on the same tab (an admin after a regular account)', () => {
    const store = memoryStore();
    rememberAdminCheck('regular-account', store);
    expect(adminCheckNeeded('admin-account', store)).toBe(true);
  });

  it('asks when there is no storage, or it throws', () => {
    expect(adminCheckNeeded('account-a', null)).toBe(true);
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => undefined,
    };
    expect(adminCheckNeeded('account-a', broken)).toBe(true);
    expect(() => rememberAdminCheck('account-a', broken)).not.toThrow();
  });
});

describe('PostHog events before they leave', () => {
  it('drops everything from a team device', () => {
    expect(prepareEvent({ event: '$pageview', properties: {} }, true, 'en')).toBeNull();
  });

  it('adds the locale and nothing else', () => {
    expect(
      prepareEvent({ event: 'sign_up', properties: { $current_url: '/x' } }, false, 'pt-BR'),
    ).toEqual({ event: 'sign_up', properties: { $current_url: '/x', locale: 'pt-BR' } });
  });
});

describe('once per action', () => {
  it('lets an id through the first time only', () => {
    const store = memoryStore();
    expect(firstTime('sign_up:account', store)).toBe(true);
    expect(firstTime('sign_up:account', store)).toBe(false);
    expect(firstTime('trip_created:a', store)).toBe(true);
  });

  it('lets the event through without storage rather than break', () => {
    expect(firstTime('x', null)).toBe(true);
  });
});

describe('track', () => {
  let local: ReturnType<typeof memoryStore>;
  let session: ReturnType<typeof memoryStore>;
  let plausible: ReturnType<typeof vi.fn>;
  let capture: ReturnType<typeof vi.fn>;
  let fbq: ReturnType<typeof vi.fn>;
  let search: string;
  let cookie: string;

  beforeEach(() => {
    local = memoryStore();
    session = memoryStore();
    plausible = vi.fn();
    capture = vi.fn();
    fbq = vi.fn();
    search = '';
    cookie = 'globetrot.consent=granted';
    vi.stubGlobal('window', {
      localStorage: local,
      sessionStorage: session,
      plausible,
      posthog: { capture },
      fbq,
      location: {
        get search() {
          return search;
        },
      },
      dispatchEvent: () => true,
    });
    vi.stubGlobal('document', {
      documentElement: { lang: 'pt-BR' },
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        const [pair] = value.split(';');
        const [name] = pair!.split('=');
        const rest = cookie.split('; ').filter((part) => part && !part.startsWith(`${name}=`));
        if (!/max-age=0/.test(value)) rest.push(pair!);
        cookie = rest.join('; ');
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the event with the page locale to Plausible, PostHog and (with consent) the Pixel', () => {
    track('sign_up', 'account');
    expect(plausible).toHaveBeenCalledWith('sign_up', { props: { locale: 'pt-BR' } });
    expect(capture).toHaveBeenCalledWith('sign_up');
    expect(fbq).toHaveBeenCalledWith('track', 'CompleteRegistration');
  });

  it('counts sign_up once when the form reports success twice', () => {
    track('sign_up', 'account');
    track('sign_up', 'account');
    expect(plausible).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledTimes(1);
    expect(fbq).toHaveBeenCalledTimes(1);
  });

  it('counts trip_created once per trip, even when the next page sends it twice', () => {
    track('trip_created', 'trip-1');
    track('trip_created', 'trip-1');
    track('trip_created', 'trip-2');
    expect(capture.mock.calls).toEqual([['trip_created'], ['trip_created']]);
  });

  it('sends nothing from a marked device, nor from the page that marks it', () => {
    search = '?interno=1';
    track('cta_click');
    search = '';
    setInternal(true, local);
    track('sign_up', 'account');
    expect(plausible).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
    expect(fbq).not.toHaveBeenCalled();
  });

  it('does not use up the once-only id on a marked device', () => {
    setInternal(true, local);
    track('sign_up', 'account');
    setInternal(false, local);
    track('sign_up', 'account');
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('keeps the Pixel out without consent', () => {
    cookie = 'globetrot.consent=denied';
    track('sign_up', 'account');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(fbq).not.toHaveBeenCalled();
  });

  it('sends what the server left once, and clears it', () => {
    cookie = `${EVENTS_COOKIE}=${encodeURIComponent('first_trip~t1|trip_created~t1')}`;
    flushPendingEvents();
    cookie = `${EVENTS_COOKIE}=${encodeURIComponent('trip_created~t1')}`;
    flushPendingEvents();
    expect(capture.mock.calls).toEqual([['first_trip'], ['trip_created']]);
    expect(cookie).not.toContain(EVENTS_COOKIE);
  });
});

describe('events finished on the server', () => {
  it('queues events in a short-lived cookie the page can read, adding to what is there', () => {
    const jar = new Map<string, string>();
    const set = vi.fn((name: string, value: string) => void jar.set(name, value));
    const store = {
      get: (name: string) => (jar.has(name) ? { value: jar.get(name)! } : undefined),
      set,
    };
    queueEvents(store, { event: 'trip_created', once: 'a1' });
    queueEvents(store, { event: 'savings_goal_set', once: 'a1' });
    expect(parsePendingEvents(jar.get(EVENTS_COOKIE))).toEqual([
      { event: 'trip_created', once: 'a1' },
      { event: 'savings_goal_set', once: 'a1' },
    ]);
    expect(set).toHaveBeenCalledWith(
      EVENTS_COOKIE,
      expect.any(String),
      expect.objectContaining({ httpOnly: false, maxAge: 120, path: '/' }),
    );
  });

  it('ignores unknown events and odd ids', () => {
    expect(
      parsePendingEvents(
        encodeURIComponent('trip_created~ok-1|evil~x|sign_up~<script>|plan_built~'),
      ),
    ).toEqual([{ event: 'trip_created', once: 'ok-1' }]);
    expect(parsePendingEvents('%E0%A4%A')).toEqual([]);
    expect(parsePendingEvents(undefined)).toEqual([]);
  });
});

describe('the origin of a visit', () => {
  const base = { search: '', referrer: '', host: 'globetrot.com.br', pathname: '/' };

  it('keeps the UTM tags, the referring domain only, and the landing path', () => {
    expect(
      visitOrigin({
        search: '?utm_source=x&utm_medium=social&utm_campaign=launch&email=a@b.c',
        referrer: 'https://www.t.co/abc?secret=1',
        host: 'globetrot.com.br',
        pathname: '/roteiros/japao-10-dias',
      }),
    ).toEqual({
      utmSource: 'x',
      utmMedium: 'social',
      utmCampaign: 'launch',
      referrer: 't.co',
      landing: '/roteiros/japao-10-dias',
    });
  });

  it('treats the site itself as a direct visit and never keeps a token from a path', () => {
    const origin = visitOrigin({
      ...base,
      referrer: 'https://globetrot.com.br/pricing',
      pathname: '/app/invite/9f8e7d6c5b4a',
    });
    expect(origin.referrer).toBe('');
    expect(origin.landing).toBe('/app/invite');
  });

  it('cuts long values short', () => {
    const origin = visitOrigin({ ...base, search: `?utm_campaign=${'a'.repeat(500)}` });
    expect(origin.utmCampaign).toHaveLength(100);
  });

  it('keeps the first page of the visit only', () => {
    const store = memoryStore();
    rememberVisitOrigin({ ...base, search: '?utm_source=x' }, store);
    rememberVisitOrigin({ ...base, search: '?utm_source=y' }, store);
    expect(readVisitOrigin(store)?.utmSource).toBe('x');
  });

  it('reads nothing back from a value that was tampered with', () => {
    const store = memoryStore();
    store.setItem('globetrot.origin', '{"utmSource":1}');
    expect(readVisitOrigin(store)).toBeNull();
    store.setItem('globetrot.origin', 'not json');
    expect(readVisitOrigin(store)).toBeNull();
  });
});
