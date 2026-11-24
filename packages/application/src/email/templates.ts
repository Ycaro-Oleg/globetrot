import { formatMoney, money, PLAN_TERMS } from '@globetrot/domain';
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
  /** The person's own trip, named in the trial emails when they have one. User text: always escaped. */
  readonly tripTitle?: string;
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

const trialTemplate = (template: EmailTemplate) =>
  template === 'trialEnding' || template === 'trialEnded';

/** A trip title on one line, without control characters, so a subject header cannot be split. */
const oneLine = (value: string) =>
  [...value]
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

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
  // The only price an email quotes comes from the pricing table, never from the catalog.
  const body = t(`email.${template}.body`, {
    price: formatMoney(money(PLAN_TERMS.explorer.monthlyMinor, 'USD'), locale, {
      precision: 'full',
    }),
  });
  // Trial emails name the person's own trip when there is one: their plan, not a product, is what they come back for.
  const trip = trialTemplate(template) && data.tripTitle ? oneLine(data.tripTitle) : null;
  const subject = trip
    ? t(`email.${template}.subjectTrip`, { trip })
    : t(`email.${template}.subject`);
  const tripLine = trip ? t(`email.${template}.trip`, { trip }) : null;
  const action = t(`email.${template}.action`);
  const expiry = t(`email.${template}.expiry`, { hours });
  const ignore = t(`email.${template}.ignore`);
  const linkHint = t('email.linkHint');
  const footer = t('email.footer');

  const text = [
    greeting,
    ...(tripLine ? [tripLine] : []),
    body,
    `${action}: ${data.url}`,
    expiry,
    ignore,
    '--',
    footer,
  ].join('\n\n');

  const url = escapeHtml(data.url);
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f8f9fa;color:#1e293b;font-family:Arial,Helvetica,sans-serif;line-height:1.5">
<div style="max-width:520px;margin:0 auto;padding:28px;background:#ffffff;border:1px solid #dde2e8;border-radius:16px">
<p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#ea580c">globetrot</p>
<p>${escapeHtml(greeting)}</p>${tripLine ? `\n<p style="font-size:18px;font-weight:bold;color:#0f172a">${escapeHtml(tripLine)}</p>` : ''}
<p>${escapeHtml(body)}</p>
<p><a href="${url}" style="display:inline-block;padding:12px 22px;background:#f97316;color:#0f172a;text-decoration:none;font-weight:bold;border-radius:999px">${escapeHtml(action)}</a></p>
<p style="font-size:14px;color:#475569">${escapeHtml(linkHint)}<br><a href="${url}" style="color:#2563eb;word-break:break-all">${url}</a></p>
<p>${escapeHtml(expiry)}</p>
<p>${escapeHtml(ignore)}</p>
<hr style="border:0;border-top:1px solid #dde2e8">
<p style="font-size:12px;color:#475569">${escapeHtml(footer)}</p>
</div>
</body>
</html>
`;

  return { subject, text, html };
}
