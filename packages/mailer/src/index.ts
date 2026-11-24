import { renderEmail, type EmailPort } from '@globetrot/application';
import nodemailer from 'nodemailer';
/** SMTP settings, read by each app's own config. */
export interface EmailConfig {
  readonly host: string;
  readonly port: number;
  /** `Name <address>` shown as the sender. */
  readonly from: string;
  readonly user: string | undefined;
  readonly password: string | undefined;
}

/**
 * The `EmailPort` over SMTP (nodemailer). Locally it talks to Mailpit, which catches everything; a production
 * provider is a matter of settings (`SMTP_*`). It renders the message in the user's language and sends the
 * plain text and the HTML together. It never logs the recipient or the link, and nodemailer's own error
 * messages (which quote addresses) never leave this function: callers get an error that has only a code.
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
    async send({ to, template, locale, data }) {
      const { subject, text, html } = renderEmail(template, locale, data);
      try {
        await transport.sendMail({ from: config.from, to, subject, text, html });
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        throw new EmailDeliveryError(typeof code === 'string' ? code : 'UNKNOWN');
      }
    },
  };
}

/** Delivery failed. The message holds only a code such as `ECONNREFUSED`: no address, no link. */
export class EmailDeliveryError extends Error {
  constructor(readonly code: string) {
    super(`email delivery failed (${code})`);
    this.name = 'EmailDeliveryError';
  }
}
