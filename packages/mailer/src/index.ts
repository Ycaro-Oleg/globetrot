import { renderEmail, type EmailPort } from '@globetrot/application';
import nodemailer from 'nodemailer';
/** Email settings, read by each app's own config (the API and the worker both send email). */
export interface EmailConfig {
  readonly host: string;
  readonly port: number;
  /** `Name <address>` shown as the sender. */
  readonly from: string;
  readonly user: string | undefined;
  readonly password: string | undefined;
  /**
   * Resend's API key. When set, email goes through Resend's HTTPS API instead of SMTP (hosts such as Railway's
   * trial plan block outgoing SMTP). Unset: SMTP, as in development with Mailpit.
   */
  readonly resendApiKey?: string | undefined;
}

/** Delivery failed. The message holds only a code such as `ECONNREFUSED`: no address, no link. */
export class EmailDeliveryError extends Error {
  constructor(readonly code: string) {
    super(`email delivery failed (${code})`);
    this.name = 'EmailDeliveryError';
  }
}

/**
 * The extra headers of a list email (ADR-0037, #191): one-click unsubscribe from the mail client itself
 * (RFC 2369, RFC 8058). The URL is re-serialised through `URL`, so a header can never carry a line break.
 */
function listHeaders(listUnsubscribe: string | undefined): Record<string, string> | undefined {
  return listUnsubscribe
    ? {
        'List-Unsubscribe': `<${new URL(listUnsubscribe).href}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      }
    : undefined;
}

/** The message's `listUnsubscribe`, once the application layer sets one (the interest list, #191). */
const listUnsubscribeOf = (message: object): string | undefined => {
  const value = (message as { listUnsubscribe?: unknown }).listUnsubscribe;
  return typeof value === 'string' ? value : undefined;
};

/**
 * The `EmailPort` over SMTP (nodemailer). Locally it talks to Mailpit, which catches everything. It renders the
 * message in the user's language and sends the plain text and the HTML together. It never logs the recipient or
 * the link, and nodemailer's own error messages (which quote addresses) never leave this function: callers get
 * an error that has only a code.
 */
export function createSmtpEmail(config: EmailConfig): EmailPort {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // 465 is implicit TLS; the other ports upgrade with STARTTLS when the server offers it.
    secure: config.port === 465,
    ...(config.user === undefined || config.password === undefined
      ? {}
      : { auth: { user: config.user, pass: config.password } }),
    connectionTimeout: 5_000,
    socketTimeout: 10_000,
  });

  return {
    async send(message) {
      const { to, template, locale, data } = message;
      const { subject, text, html } = renderEmail(template, locale, data);
      const headers = listHeaders(listUnsubscribeOf(message));
      try {
        await transport.sendMail({
          from: config.from,
          to,
          subject,
          text,
          html,
          ...(headers ? { headers } : {}),
        });
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        throw new EmailDeliveryError(typeof code === 'string' ? code : 'UNKNOWN');
      }
    },
  };
}

export const RESEND_ENDPOINT = 'https://api.resend.com/emails';
/** How long a send may take before it counts as failed (`RESEND_TIMEOUT`). */
export const RESEND_TIMEOUT_MS = 10_000;

/**
 * The `EmailPort` over Resend's HTTPS API (`POST /emails`, bearer key). Same rendering as SMTP. A failure becomes
 * an `EmailDeliveryError` with a code only: `RESEND_<status>` for an error answer, `RESEND_TIMEOUT` after
 * `RESEND_TIMEOUT_MS`, `RESEND_NETWORK` when Resend cannot be reached. Resend's error body is never read, because
 * it can quote the address; the key is never logged.
 */
export function createResendEmail(
  config: { readonly from: string; readonly apiKey: string },
  options: { readonly fetch?: typeof fetch | undefined; readonly timeoutMs?: number } = {},
): EmailPort {
  const call = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? RESEND_TIMEOUT_MS;
  return {
    async send(message) {
      const { to, template, locale, data } = message;
      const { subject, text, html } = renderEmail(template, locale, data);
      const headers = listHeaders(listUnsubscribeOf(message));
      let response: Response;
      try {
        response = await call(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: config.from,
            to: [to],
            subject,
            text,
            html,
            ...(headers ? { headers } : {}),
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const name = (error as { name?: unknown }).name;
        throw new EmailDeliveryError(
          name === 'TimeoutError' || name === 'AbortError' ? 'RESEND_TIMEOUT' : 'RESEND_NETWORK',
        );
      }
      if (!response.ok) {
        // Release the connection without reading what Resend said.
        await response.body?.cancel().catch(() => {});
        throw new EmailDeliveryError(`RESEND_${response.status}`);
      }
    },
  };
}

/** Resend's HTTPS API when its key is set, SMTP otherwise. What the API and the worker use. */
export function createEmail(
  config: EmailConfig,
  options: { readonly fetch?: typeof fetch | undefined } = {},
): EmailPort {
  return config.resendApiKey
    ? createResendEmail({ from: config.from, apiKey: config.resendApiKey }, options)
    : createSmtpEmail(config);
}
