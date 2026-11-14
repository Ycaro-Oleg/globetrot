import { formatMessage, type SupportedLocale } from '@globetrot/i18n';

/** The transactional emails the product sends. A new template needs its strings in every catalog. */
export type EmailTemplate = 'verifyEmail' | 'resetPassword' | 'trialEnding' | 'trialEnded';

export interface EmailData {
  /** The single-use link the email exists for. Must be an http(s) URL. */
  readonly url: string;
  /** What to call the person. */
  readonly name: string;
  /** How long the link works, shown as whole hours (at least 1). */
  readonly expiresInHours: number;
}

export interface EmailMessage {
  readonly to: string;
  readonly template: EmailTemplate;
  readonly locale: SupportedLocale;
  readonly data: EmailData;
}

export interface RenderedEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * Sends one email. The application layer only says *what* and *to whom*; how it travels (SMTP to Mailpit in
 * development, a provider later) belongs to the adapter. Implementations must not log the recipient or the
 * link.
 */
export interface EmailPort {
  send(message: EmailMessage): Promise<void>;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

function assertHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new TypeError('The email link is not a URL');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError('The email link must be an http(s) URL');
  }
}

/**
 * The subject, plain text and HTML of an email, in the user's language. Every string comes from the
 * `email` catalog namespace. The HTML is deliberately plain: one link, inline styles, no remote images,
 * no tracking pixels and no tracked links. Anything interpolated is escaped.
 */
export function renderEmail(
  template: EmailTemplate,
  locale: SupportedLocale,
  data: EmailData,
): RenderedEmail {
  assertHttpUrl(data.url);
  const hours = Math.max(1, Math.round(data.expiresInHours));
  const t = (key: string, values: Record<string, string | number> = {}) =>
    formatMessage(locale, key as never, values);

  const greeting = t('email.greeting', { name: data.name });
  const body = t(`email.${template}.body`);
  const action = t(`email.${template}.action`);
  const expiry = t(`email.${template}.expiry`, { hours });
  const ignore = t(`email.${template}.ignore`);
  const linkHint = t('email.linkHint');
  const footer = t('email.footer');

  const text = [greeting, body, `${action}: ${data.url}`, expiry, ignore, '--', footer].join(
    '\n\n',
  );

  const url = escapeHtml(data.url);
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(t(`email.${template}.subject`))}</title></head>
<body style="margin:0;padding:24px;background:#fff5e1;color:#1a1a2e;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
<div style="max-width:520px;margin:0 auto">
<p>${escapeHtml(greeting)}</p>
<p>${escapeHtml(body)}</p>
<p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#1a1a2e;color:#fff5e1;text-decoration:none;font-weight:bold;border-radius:8px">${escapeHtml(action)}</a></p>
<p>${escapeHtml(linkHint)}<br><a href="${url}" style="color:#1a1a2e;word-break:break-all">${url}</a></p>
<p>${escapeHtml(expiry)}</p>
<p>${escapeHtml(ignore)}</p>
<hr style="border:0;border-top:1px solid #1a1a2e33">
<p style="font-size:12px;color:#555">${escapeHtml(footer)}</p>
</div>
</body>
</html>
`;

  return { subject: t(`email.${template}.subject`), text, html };
}
