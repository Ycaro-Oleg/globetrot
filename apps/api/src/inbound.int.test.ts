// Bookings forwarded by email against a real PostgreSQL (ADR-0032): the provider's webhook needs the shared
// secret, the address's token says whose email it is, and the email becomes a Pip proposal to review.
import { randomBytes } from 'node:crypto';
import { createFakeEmail } from '@globetrot/application/testing';
import { createTestDatabase, type TestDatabase } from '@globetrot/db/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { loadApiConfig } from './config';
import { createServices } from './wire';

const SECRET = 'inbound-secret-for-tests-0123456789';
const databases: TestDatabase[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.drop()));
});

describe('forwarded booking emails against a real database', () => {
  it('needs the secret, finds the account by its address and proposes the booking on its latest trip', async () => {
    const database = await createTestDatabase();
    databases.push(database);
    const config = loadApiConfig({
      NODE_ENV: 'test',
      DATABASE_URL: database.url,
      BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
      REQUIRE_VERIFIED_EMAIL: 'false',
      INBOUND_EMAIL_SECRET: SECRET,
      INBOUND_EMAIL_DOMAIN: 'in.globetrot.example',
    });
    const asked: string[] = [];
    const { app } = createServices(database.db, config, {
      email: createFakeEmail().port,
      ai: {
        async completeJson(input) {
          asked.push(input.user);
          return {
            content: '{"summary":"Hotel in Lisbon","changes":[]}',
            provider: 'fake',
            model: 'fake-1',
            inputTokens: 10,
            outputTokens: 5,
          };
        },
      },
    });
    const origin = config.auth.baseURL;
    const signUp = await app.request(`${origin}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', 'x-forwarded-for': '198.18.9.1' },
      body: JSON.stringify({
        name: 'Ana',
        email: 'ana@example.com',
        password: 'correct horse battery staple',
      }),
    });
    const cookie = signUp.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const call = async (method: string, path: string, body?: unknown) => {
      const response = await app.request(`${origin}${path}`, {
        method,
        headers: { origin, cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return (await response.json()) as Record<string, unknown>;
    };
    const { address } = (await call('POST', '/v1/me/inbound')) as { address: string };
    expect(address).toMatch(/^trips\+[a-z0-9]{16,40}@in\.globetrot\.example$/);
    const trip = await call('POST', '/v1/trips', { title: 'Lisboa' });

    const post = (secret: string, body: unknown) =>
      app.request(`${origin}/v1/inbound/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-inbound-secret': secret },
        body: JSON.stringify(body),
      });
    const email = {
      To: address,
      MailboxHash: address.split('+')[1]!.split('@')[0],
      Subject: 'Your stay in Lisbon',
      TextBody: 'Check-in 12 March 2027, 3 nights, total EUR 420',
    };
    expect((await post('wrong-secret-wrong-secret-0000000', email)).status).toBe(401);
    const received = await post(SECRET, email);
    expect(received.status).toBe(200);
    expect(await received.json()).toEqual({ outcome: 'proposed' });
    expect(asked.at(-1)).toContain('Check-in 12 March 2027');
    const proposals = (await call('GET', `/v1/trips/${trip.id}/pip/proposals`)) as {
      proposals: { summary: string; status: string }[];
    };
    expect(proposals.proposals).toMatchObject([{ summary: 'Hotel in Lisbon', status: 'proposed' }]);
    expect(
      await (await post(SECRET, { ...email, MailboxHash: 'unknownunknownunknown' })).json(),
    ).toEqual({ outcome: 'unknown-address' });
  });
});
