import { describe, expect, it } from 'vitest';
import { createApplication, ValidationError, type Actor, type UserRecord } from '../index';
import { createFakePorts } from '../testing';

const ana: UserRecord = { id: 'u-ana', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const bruno: UserRecord = {
  id: 'u-bruno',
  email: 'bruno@example.com',
  name: 'Bruno',
  emailVerified: true,
};
const as = (user: UserRecord): Actor => ({ kind: 'user', userId: user.id });

const FULL = {
  locale: 'pt-BR',
  currency: 'EUR',
  homeCountry: 'BR',
  nationality: 'PT',
  timeZone: 'America/Sao_Paulo',
  units: 'imperial',
  theme: 'red-eye',
  motion: 'reduced',
} as const;

function setup() {
  const fake = createFakePorts({ users: [ana, bruno] });
  return { ...fake, app: createApplication(fake.ports) };
}

async function issuesOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ValidationError);
  return (error as ValidationError).issues;
}

describe('getPreferences', () => {
  it('gives a user who saved nothing USD, the default language and no country, nationality or time zone', async () => {
    const { app } = setup();
    expect(await app.getPreferences.execute(as(ana), {})).toEqual({
      locale: 'en',
      currency: 'USD',
      homeCountry: null,
      nationality: null,
      timeZone: null,
      units: 'metric',
      theme: 'system',
      motion: 'full',
    });
  });

  it('returns what was saved', async () => {
    const { app } = setup();
    await app.updatePreferences.execute(as(ana), FULL);
    expect(await app.getPreferences.execute(as(ana), {})).toEqual(FULL);
  });
});

describe('updatePreferences changes one field and nothing else', () => {
  it.each([
    ['locale', 'en'],
    ['currency', 'JPY'],
    ['homeCountry', 'JP'],
    ['nationality', 'US'],
    ['timeZone', 'Asia/Tokyo'],
    ['units', 'metric'],
    ['theme', 'day'],
    ['motion', 'full'],
  ] as const)('%s', async (field, value) => {
    const { app } = setup();
    await app.updatePreferences.execute(as(ana), FULL);
    const updated = await app.updatePreferences.execute(as(ana), { [field]: value });
    expect(updated).toEqual({ ...FULL, [field]: value });
    expect(await app.getPreferences.execute(as(ana), {})).toEqual({ ...FULL, [field]: value });
  });

  it('keeps the defaults for everything else on the first save', async () => {
    const { app } = setup();
    const updated = await app.updatePreferences.execute(as(ana), { locale: 'pt-BR' });
    // Choosing Portuguese does not make the currency BRL or the country Brazil.
    expect(updated).toEqual({
      locale: 'pt-BR',
      currency: 'USD',
      homeCountry: null,
      nationality: null,
      timeZone: null,
      units: 'metric',
      theme: 'system',
      motion: 'full',
    });
  });

  it('lets a pt-BR user keep USD and an en user pick BRL', async () => {
    const { app } = setup();
    expect(
      await app.updatePreferences.execute(as(ana), { locale: 'pt-BR', currency: 'USD' }),
    ).toMatchObject({
      locale: 'pt-BR',
      currency: 'USD',
    });
    expect(
      await app.updatePreferences.execute(as(bruno), { locale: 'en', currency: 'BRL' }),
    ).toMatchObject({
      locale: 'en',
      currency: 'BRL',
    });
  });

  it('clears the optional fields with null and leaves the others', async () => {
    const { app } = setup();
    await app.updatePreferences.execute(as(ana), FULL);
    const updated = await app.updatePreferences.execute(as(ana), {
      homeCountry: null,
      nationality: null,
      timeZone: null,
    });
    expect(updated).toEqual({
      ...FULL,
      homeCountry: null,
      nationality: null,
      timeZone: null,
    });
  });

  it('stores the time zone in its canonical spelling', async () => {
    const { app } = setup();
    expect(
      (await app.updatePreferences.execute(as(ana), { timeZone: 'europe/lisbon' })).timeZone,
    ).toBe('Europe/Lisbon');
  });
});

describe('updatePreferences validation', () => {
  it.each([
    ['an unknown language', { locale: 'fr' }, 'locale', 'custom'],
    ['a language tag with a different case', { locale: 'pt-br' }, 'locale', 'custom'],
    ['an unknown currency', { currency: 'XXX' }, 'currency', 'custom'],
    ['a lower-case currency', { currency: 'usd' }, 'currency', 'invalid_format'],
    ['an unknown country', { homeCountry: 'XX' }, 'homeCountry', 'custom'],
    ['a lower-case country', { nationality: 'br' }, 'nationality', 'invalid_format'],
    ['a three-letter country', { homeCountry: 'BRA' }, 'homeCountry', 'invalid_format'],
    ['an unknown time zone', { timeZone: 'Mars/Olympus' }, 'timeZone', 'custom'],
    ['a UTC offset instead of a time zone', { timeZone: '+01:00' }, 'timeZone', 'custom'],
    ['an unknown unit system', { units: 'nautical' }, 'units', 'invalid_value'],
    ['an unknown theme', { theme: 'night' }, 'theme', 'invalid_value'],
    ['an unknown motion setting', { motion: 'none' }, 'motion', 'invalid_value'],
    ['a null theme (it cannot be cleared)', { theme: null }, 'theme', 'invalid_value'],
    ['a null language (it cannot be cleared)', { locale: null }, 'locale', 'invalid_type'],
    ['a null currency (it cannot be cleared)', { currency: null }, 'currency', 'invalid_type'],
    ['nothing to change', {}, '', 'custom'],
  ])('rejects %s with a stable code and saves nothing', async (_name, input, field, code) => {
    const { app, state } = setup();
    const issues = await issuesOf(app.updatePreferences.execute(as(ana), input as never));
    expect(issues).toContainEqual(expect.objectContaining({ field, code }));
    expect(state.preferences.size).toBe(0);
    expect(state.audit).toHaveLength(0);
  });
});

describe('appearance', () => {
  it('starts on the system theme with full motion, and changing the language moves neither', async () => {
    const { app } = setup();
    const first = await app.updatePreferences.execute(as(ana), { locale: 'pt-BR' });
    expect(first).toMatchObject({ theme: 'system', motion: 'full' });
    await app.updatePreferences.execute(as(ana), { theme: 'red-eye', motion: 'reduced' });
    const later = await app.updatePreferences.execute(as(ana), { locale: 'en', currency: 'JPY' });
    expect(later).toMatchObject({ theme: 'red-eye', motion: 'reduced' });
  });
});

describe('ownership', () => {
  it('cannot be pointed at another user: there is no user id to send, and a sneaky one is ignored', async () => {
    const { app } = setup();
    await app.updatePreferences.execute(as(bruno), { currency: 'JPY', homeCountry: 'JP' });

    await app.updatePreferences.execute(as(ana), {
      currency: 'EUR',
      userId: 'u-bruno',
    } as never);

    expect(await app.getPreferences.execute(as(bruno), {})).toMatchObject({
      currency: 'JPY',
      homeCountry: 'JP',
    });
    expect(await app.getPreferences.execute(as(ana), {})).toMatchObject({ currency: 'EUR' });
  });

  it('keeps each user’s settings apart', async () => {
    const { app } = setup();
    await app.updatePreferences.execute(as(ana), { homeCountry: 'BR', locale: 'pt-BR' });
    expect(await app.getPreferences.execute(as(bruno), {})).toMatchObject({
      locale: 'en',
      homeCountry: null,
    });
  });
});

describe('audit', () => {
  it('records the names of the changed fields and never their values', async () => {
    const { app, state } = setup();
    await app.updatePreferences.execute(as(ana), {
      homeCountry: 'BR',
      timeZone: 'America/Sao_Paulo',
      currency: 'EUR',
    });
    expect(state.audit).toEqual([
      expect.objectContaining({
        actor: { kind: 'user', userId: 'u-ana' },
        action: 'preferences.update',
        entityType: 'user_preference',
        entityId: 'u-ana',
        metadata: { fields: ['currency', 'homeCountry', 'timeZone'] },
      }),
    ]);
    const text = JSON.stringify(state.audit);
    for (const personal of ['BR', 'Sao_Paulo', 'EUR']) expect(text).not.toContain(personal);
  });
});
