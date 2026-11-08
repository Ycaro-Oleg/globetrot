/**
 * The browser's calls to the auth endpoints (`/api/auth/*`, proxied to the API so the session cookie stays
 * first-party). Plain `fetch`, no secrets in URLs, and the result is a value, never a thrown error, so a form
 * can always render something. Passwords only ever travel in the JSON body of these requests.
 */

export type AuthFailure =
  | {
      readonly ok: false;
      readonly kind: 'api';
      readonly status: number;
      /** Better Auth's or our stable `code`, when the body had one. */
      readonly code: string | undefined;
      /** Seconds to wait, from `Retry-After`, when the server asked. */
      readonly retryAfter: number | undefined;
    }
  | { readonly ok: false; readonly kind: 'network' };

export type AuthResult<T = Record<string, unknown>> =
  { readonly ok: true; readonly data: T } | AuthFailure;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Where the verification email's link leads once it has been followed. */
export const VERIFIED_PAGE = '/email-verified';
/** Where the reset email's link lands (Better Auth appends `?token=…` or `?error=INVALID_TOKEN`). */
export const RESET_PAGE = '/reset-password';

function secondsFrom(header: string | null): number | undefined {
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : undefined;
}

async function post<T = Record<string, unknown>>(
  fetchImpl: FetchLike,
  path: string,
  body: unknown,
): Promise<AuthResult<T>> {
  let response: Response;
  try {
    response = await fetchImpl(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, kind: 'network' };
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.ok) return { ok: true, data: (payload ?? {}) as T };
  const code = typeof payload?.code === 'string' ? payload.code : undefined;
  return {
    ok: false,
    kind: 'api',
    status: response.status,
    code,
    retryAfter: secondsFrom(response.headers.get('retry-after')),
  };
}

export function createAuthClient(fetchImpl: FetchLike = (input, init) => fetch(input, init)) {
  return {
    signIn: (input: { email: string; password: string }) =>
      post<{ token?: string | null }>(fetchImpl, '/api/auth/sign-in/email', input),

    /** `data.token` is `null` while the address still has to be verified: no session was opened. */
    signUp: (input: { name: string; email: string; password: string }) =>
      post<{ token?: string | null }>(fetchImpl, '/api/auth/sign-up/email', {
        ...input,
        callbackURL: VERIFIED_PAGE,
      }),

    resendVerification: (input: { email: string }) =>
      post(fetchImpl, '/api/auth/send-verification-email', {
        ...input,
        callbackURL: VERIFIED_PAGE,
      }),

    /** The answer is the same for an address with an account and one without. */
    requestReset: (input: { email: string }, origin: string) =>
      post(fetchImpl, '/api/auth/request-password-reset', {
        ...input,
        redirectTo: `${origin}${RESET_PAGE}`,
      }),

    resetPassword: (input: { newPassword: string; token: string }) =>
      post(fetchImpl, '/api/auth/reset-password', input),

    signOut: () => post(fetchImpl, '/api/auth/sign-out', {}),

    /** Starts the Google flow. `data.url` is where the browser goes next. */
    signInWithGoogle: (callbackURL: string) =>
      post<{ url?: string }>(fetchImpl, '/api/auth/sign-in/social', {
        provider: 'google',
        callbackURL,
      }),
  };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
