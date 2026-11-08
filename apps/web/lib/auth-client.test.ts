import { describe, expect, it } from 'vitest';
import { createAuthClient } from './auth-client';
import { describeFailure } from './auth-errors';

interface Call {
  path: string;
  init: RequestInit;
}

function clientWith(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const client = createAuthClient(async (path, init) => {
    calls.push({ path, init });
    return respond();
  });
  return { client, calls };
}

const bodyOf = (call: Call | undefined) =>
  JSON.parse(String(call?.init.body)) as Record<string, unknown>;

describe('auth client requests', () => {
  it('posts JSON to the same-origin auth endpoints, with the password only in the body', async () => {
    const { client, calls } = clientWith(() => Response.json({ token: 'abc' }));

    await client.signIn({ email: 'ana@example.com', password: 'correct horse' });

    expect(calls[0]?.path).toBe('/api/auth/sign-in/email');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.credentials).toBe('same-origin');
    expect(bodyOf(calls[0])).toEqual({ email: 'ana@example.com', password: 'correct horse' });
    // Nothing secret in the URL.
    expect(calls[0]?.path).not.toMatch(/ana|correct|password/);
  });

  it('asks the verification link to lead to the confirmation page', async () => {
    const { client, calls } = clientWith(() => Response.json({ token: null }));
    const result = await client.signUp({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'a long passphrase',
    });
    expect(calls[0]?.path).toBe('/api/auth/sign-up/email');
    expect(bodyOf(calls[0])).toMatchObject({ name: 'Ana', callbackURL: '/email-verified' });
    expect(result).toEqual({ ok: true, data: { token: null } });

    await client.resendVerification({ email: 'ana@example.com' });
    expect(calls[1]?.path).toBe('/api/auth/send-verification-email');
    expect(bodyOf(calls[1])).toEqual({ email: 'ana@example.com', callbackURL: '/email-verified' });
  });

  it('asks the reset link to land on this site’s reset page', async () => {
    const { client, calls } = clientWith(() => Response.json({ status: true }));
    await client.requestReset({ email: 'ana@example.com' }, 'https://app.example.test');
    expect(calls[0]?.path).toBe('/api/auth/request-password-reset');
    expect(bodyOf(calls[0])).toEqual({
      email: 'ana@example.com',
      redirectTo: 'https://app.example.test/reset-password',
    });

    await client.resetPassword({ newPassword: 'a different passphrase', token: 't0k3n' });
    expect(calls[1]?.path).toBe('/api/auth/reset-password');
    expect(bodyOf(calls[1])).toEqual({ newPassword: 'a different passphrase', token: 't0k3n' });
  });

  it('starts the Google flow, signs out, and posts nothing else', async () => {
    const { client, calls } = clientWith(() =>
      Response.json({ url: 'https://accounts.example/o' }),
    );
    expect(await client.signInWithGoogle('/app')).toEqual({
      ok: true,
      data: { url: 'https://accounts.example/o' },
    });
    expect(bodyOf(calls[0])).toEqual({ provider: 'google', callbackURL: '/app' });
    await client.signOut();
    expect(calls[1]?.path).toBe('/api/auth/sign-out');
  });
});

describe('auth client results', () => {
  it('reports the stable code, the status and Retry-After of a failure', async () => {
    const { client } = clientWith(
      () =>
        new Response(JSON.stringify({ code: 'EMAIL_COOLDOWN', message: 'English text' }), {
          status: 429,
          headers: { 'retry-after': '12' },
        }),
    );
    expect(await client.resendVerification({ email: 'a@example.com' })).toEqual({
      ok: false,
      kind: 'api',
      status: 429,
      code: 'EMAIL_COOLDOWN',
      retryAfter: 12,
    });
  });

  it('copes with an error that has no JSON body, and with a bad Retry-After', async () => {
    const { client } = clientWith(
      () =>
        new Response('<html>bad gateway</html>', {
          status: 502,
          headers: { 'retry-after': 'soon' },
        }),
    );
    expect(await client.signOut()).toEqual({
      ok: false,
      kind: 'api',
      status: 502,
      code: undefined,
      retryAfter: undefined,
    });
  });

  it('turns a network error into a value instead of throwing', async () => {
    const client = createAuthClient(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await client.signIn({ email: 'a@example.com', password: 'x' })).toEqual({
      ok: false,
      kind: 'network',
    });
  });
});

describe('describeFailure', () => {
  const api = (status: number, code?: string, retryAfter?: number) =>
    ({ ok: false, kind: 'api', status, code, retryAfter }) as const;

  it('gives one generic banner for bad credentials, the same for any account', () => {
    const wrongPassword = describeFailure(api(401, 'INVALID_EMAIL_OR_PASSWORD'), 'login');
    const unknownEmail = describeFailure(api(401), 'login');
    expect(wrongPassword).toEqual(unknownEmail);
    expect(wrongPassword.banner).toEqual({ key: 'errors.invalidCredentials' });
    expect(wrongPassword.fields).toEqual({});
  });

  it('offers to resend the link when the address is not verified', () => {
    const view = describeFailure(api(403, 'EMAIL_NOT_VERIFIED'), 'login');
    expect(view.banner).toEqual({ key: 'errors.notVerified' });
    expect(view.offerResend).toBe(true);
  });

  it.each(['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'])(
    'shows a duplicate email (%s) under the email field with a way to log in',
    (code) => {
      const view = describeFailure(api(422, code), 'signup');
      expect(view.fields.email).toEqual({ key: 'errors.emailTaken' });
      expect(view.offerLogin).toBe(true);
      expect(view.banner).toBeNull();
    },
  );

  it.each([
    ['PASSWORD_TOO_SHORT', 'errors.passwordTooShort'],
    ['PASSWORD_TOO_LONG', 'errors.passwordTooLong'],
  ])('shows %s under the password field, on sign-up and on reset', (code, key) => {
    expect(describeFailure(api(400, code), 'signup').fields.password).toEqual({ key });
    expect(describeFailure(api(400, code), 'reset').fields.password).toEqual({ key });
  });

  it('explains a reset token that is expired, used or unknown', () => {
    expect(describeFailure(api(400, 'INVALID_TOKEN'), 'reset').banner).toEqual({
      key: 'errors.invalidToken',
    });
  });

  it('turns a rate limit into a wait, using Retry-After when it is there', () => {
    expect(describeFailure(api(429, 'EMAIL_COOLDOWN', 17), 'resend')).toMatchObject({
      retryAfter: 17,
      banner: { key: 'errors.rateLimited', values: { seconds: 17 } },
    });
    expect(describeFailure(api(429), 'login').banner).toEqual({
      key: 'errors.rateLimited',
      values: { seconds: 30 },
    });
  });

  it('says the server could not be reached', () => {
    expect(describeFailure({ ok: false, kind: 'network' }, 'login').banner).toEqual({
      key: 'errors.network',
    });
  });

  it('falls back to a generic message for anything unexpected, never the server text', () => {
    for (const form of ['login', 'signup', 'recover', 'reset', 'resend'] as const) {
      expect(describeFailure(api(500, 'SOMETHING_NEW'), form).banner).toEqual({
        key: 'errors.generic',
      });
    }
  });
});
