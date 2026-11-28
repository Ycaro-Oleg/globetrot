// The email adapters of @globetrot/mailer: Resend's HTTPS API (with a stand-in fetch) and the choice between it
// and SMTP. No real key and no real address: made-up values on reserved domains.
import type { EmailMessage } from '@globetrot/application';
import {
  createEmail,
  createResendEmail,
  EmailDeliveryError,
  RESEND_ENDPOINT,
} from '@globetrot/mailer';
import { afterEach, describe, expect, it, vi } from 'vitest';

const KEY = 're_test_not_a_real_key_0000';
const FROM = 'Globetrot <hello@example.test>';
const message: EmailMessage = {
  to: 'ana@example.test',
  template: 'verifyEmail',
  locale: 'pt-BR',
  data: {
    url: 'https://app.example.test/api/auth/verify-email?token=secret-token',
    name: 'Ana',
    expiresInHours: 24,
  },
};

interface Call {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(answer: () => Promise<Response> | Response) {
  const calls: Call[] = [];
  const call: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return answer();
  };
  return { calls, call };
}

const failureOf = async (send: Promise<void>) => {
  try {
    await send;
  } catch (error) {
    return error as EmailDeliveryError;
  }
  throw new Error('expected the send to fail');
};

afterEach(() => vi.restoreAllMocks());

describe('Resend over HTTPS', () => {
  it('posts the rendered email with the key as a bearer token', async () => {
    const api = fakeFetch(() => new Response('{"id":"x"}', { status: 200 }));
    await createResendEmail({ from: FROM, apiKey: KEY }, { fetch: api.call }).send(message);
    expect(api.calls).toHaveLength(1);
    const { url, init } = api.calls[0]!;
    expect(url).toBe(RESEND_ENDPOINT);
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${KEY}`);
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ from: FROM, to: ['ana@example.test'] });
    expect(String(body.subject)).not.toBe('');
    expect(String(body.text)).toContain('secret-token');
    expect(String(body.html)).toContain('<html lang="pt-BR">');
    expect(body).not.toHaveProperty('headers');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends the one-click unsubscribe headers of a list email, the URL re-serialised', async () => {
    const api = fakeFetch(() => new Response('{}', { status: 200 }));
    await createResendEmail({ from: FROM, apiKey: KEY }, { fetch: api.call }).send({
      ...message,
      listUnsubscribe: 'https://app.example.test/v1/leads/unsubscribe?token=a.b',
    } as EmailMessage);
    const body = JSON.parse(String(api.calls[0]!.init.body)) as { headers: Record<string, string> };
    expect(body.headers).toEqual({
      'List-Unsubscribe': '<https://app.example.test/v1/leads/unsubscribe?token=a.b>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
  });

  it.each([400, 401, 403, 422, 429, 500, 503])(
    'turns a %i into a code only, without reading what Resend said',
    async (status) => {
      const said = `{"message":"invalid to: ana@example.test with ${KEY}"}`;
      const response = new Response(said, { status });
      const read = vi.spyOn(response, 'json');
      const api = fakeFetch(() => response);
      const error = await failureOf(
        createResendEmail({ from: FROM, apiKey: KEY }, { fetch: api.call }).send(message),
      );
      expect(error).toBeInstanceOf(EmailDeliveryError);
      expect(error.code).toBe(`RESEND_${status}`);
      expect(error.message).toBe(`email delivery failed (RESEND_${status})`);
      expect(read).not.toHaveBeenCalled();
      expect(`${error.message} ${error.stack ?? ''}`).not.toMatch(
        /ana@example\.test|re_test|token/,
      );
    },
  );

  it('gives up after the timeout with RESEND_TIMEOUT', async () => {
    const api = fakeFetch(() => new Promise<Response>(() => {}));
    const call: typeof fetch = (input, init) =>
      new Promise((_, reject) => {
        void api.call(input, init);
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const error = await failureOf(
      createResendEmail({ from: FROM, apiKey: KEY }, { fetch: call, timeoutMs: 20 }).send(message),
    );
    expect(error.code).toBe('RESEND_TIMEOUT');
  });

  it('answers RESEND_NETWORK when Resend cannot be reached, without the cause’s text', async () => {
    const api = fakeFetch(() => {
      throw new TypeError(`fetch failed for ana@example.test`);
    });
    const error = await failureOf(
      createResendEmail({ from: FROM, apiKey: KEY }, { fetch: api.call }).send(message),
    );
    expect(error.code).toBe('RESEND_NETWORK');
    expect(error.message).not.toContain('ana@example.test');
  });

  it('logs nothing of its own', async () => {
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    const api = fakeFetch(
      () => new Response('{"message":"bad ana@example.test"}', { status: 422 }),
    );
    await failureOf(
      createResendEmail({ from: FROM, apiKey: KEY }, { fetch: api.call }).send(message),
    );
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });
});

describe('choosing the transport', () => {
  const smtp = {
    host: 'localhost',
    port: 1,
    from: FROM,
    user: undefined,
    password: undefined,
  };

  it('uses Resend’s API when the key is set', async () => {
    const api = fakeFetch(() => new Response('{}', { status: 200 }));
    await createEmail({ ...smtp, resendApiKey: KEY }, { fetch: api.call }).send(message);
    expect(api.calls.map((c) => c.url)).toEqual([RESEND_ENDPOINT]);
  });

  it('uses SMTP without the key, and never calls Resend', async () => {
    const api = fakeFetch(() => new Response('{}', { status: 200 }));
    // Nothing listens on port 1: the SMTP attempt fails with a code, and Resend is not touched.
    const error = await failureOf(createEmail(smtp, { fetch: api.call }).send(message));
    expect(error).toBeInstanceOf(EmailDeliveryError);
    expect(error.code).not.toMatch(/^RESEND_/);
    expect(api.calls).toEqual([]);
  });
});
