import type { AuthFailure } from './auth-client';

/** A message in the `auth` catalog namespace, with its values. Screens translate it. */
export interface MessageRef {
  readonly key: string;
  readonly values?: Record<string, string | number>;
}

export interface FailureView {
  /** A message above the form, announced to assistive technology. */
  readonly banner: MessageRef | null;
  /** Messages under single fields. */
  readonly fields: { readonly email?: MessageRef; readonly password?: MessageRef };
  /** Offer to send the verification link again. */
  readonly offerResend: boolean;
  /** Offer a link to the log-in page (a duplicate email). */
  readonly offerLogin: boolean;
  /** Seconds to wait before trying again, when the server said so. */
  readonly retryAfter: number | undefined;
}

export type AuthForm = 'login' | 'signup' | 'recover' | 'reset' | 'resend';

const NONE: FailureView = {
  banner: null,
  fields: {},
  offerResend: false,
  offerLogin: false,
  retryAfter: undefined,
};

const DUPLICATE = new Set(['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL']);

/**
 * Turns what the server said into what a person sees. The server's `message` is never shown (it is English and
 * may change); only the stable `code` and the HTTP status are used. Bad credentials are one generic banner, the
 * same for an unknown address and a wrong password, as the server answers.
 */
export function describeFailure(failure: AuthFailure, form: AuthForm): FailureView {
  if (failure.kind === 'network') return { ...NONE, banner: { key: 'errors.network' } };

  const { status, code, retryAfter } = failure;

  if (status === 429) {
    return {
      ...NONE,
      retryAfter,
      banner: { key: 'errors.rateLimited', values: { seconds: retryAfter ?? 30 } },
    };
  }

  if (form === 'login' && code === 'EMAIL_NOT_VERIFIED') {
    return { ...NONE, offerResend: true, banner: { key: 'errors.notVerified' } };
  }
  if (form === 'login' && (code === 'INVALID_EMAIL_OR_PASSWORD' || status === 401)) {
    return { ...NONE, banner: { key: 'errors.invalidCredentials' } };
  }

  if (form === 'signup') {
    if (code !== undefined && DUPLICATE.has(code)) {
      return { ...NONE, offerLogin: true, fields: { email: { key: 'errors.emailTaken' } } };
    }
    if (code === 'PASSWORD_TOO_SHORT') {
      return { ...NONE, fields: { password: { key: 'errors.passwordTooShort' } } };
    }
    if (code === 'PASSWORD_TOO_LONG') {
      return { ...NONE, fields: { password: { key: 'errors.passwordTooLong' } } };
    }
    if (code === 'INVALID_EMAIL') {
      return { ...NONE, fields: { email: { key: 'errors.invalidEmail' } } };
    }
  }

  if (form === 'reset') {
    if (code === 'INVALID_TOKEN') return { ...NONE, banner: { key: 'errors.invalidToken' } };
    if (code === 'PASSWORD_TOO_SHORT') {
      return { ...NONE, fields: { password: { key: 'errors.passwordTooShort' } } };
    }
    if (code === 'PASSWORD_TOO_LONG') {
      return { ...NONE, fields: { password: { key: 'errors.passwordTooLong' } } };
    }
  }

  return { ...NONE, banner: { key: 'errors.generic' } };
}
