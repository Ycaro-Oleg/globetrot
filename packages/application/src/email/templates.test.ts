import { formatMoney, money, PLAN_TERMS } from '@globetrot/domain';
import { catalogs, SUPPORTED_LOCALES } from '@globetrot/i18n';
import { describe, expect, it } from 'vitest';
import { renderEmail, type EmailData, type EmailTemplate } from './templates';

const TEMPLATES: EmailTemplate[] = ['verifyEmail', 'resetPassword', 'trialEnding', 'trialEnded'];
const URL_ = 'https://app.example.test/api/auth/verify-email?token=abc.def&callbackURL=%2F';
const DATA: EmailData = { url: URL_, name: 'Ana', expiresInHours: 24 };

/** The visible words of an HTML email, entities decoded. */
const words = (html: string) =>
  html
    .replace(/<head>[\s\S]*?<\/head>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/\s+/g, ' ');

describe.each(SUPPORTED_LOCALES)('renderEmail in %s', (locale) => {
  const copy = catalogs[locale].email;

  it('quotes the Explorer price from the pricing table', () => {
    const { text } = renderEmail('trialEnding', locale, DATA);
    expect(text).not.toContain('{price}');
    expect(text.replace(/\s+/g, ' ')).toMatch(/4[.,]99/);
  });

  it.each(TEMPLATES)('%s uses the catalog subject, in the right language', (template) => {
    expect(renderEmail(template, locale, DATA).subject).toBe(copy[template].subject);
  });

  it.each(TEMPLATES)('%s carries the same content in the text and the HTML', (template) => {
    const { text, html } = renderEmail(template, locale, DATA);
    const visible = words(html);
    const strings = [
      copy.greeting.replace('{name}', 'Ana'),
      copy[template].body.replace(
        '{price}',
        formatMoney(money(PLAN_TERMS.explorer.monthlyMinor, 'USD'), locale, { precision: 'full' }),
      ),
      copy[template].action,
      copy.footer,
      copy[template].ignore,
    ];
    for (const value of strings) {
      expect(text, value).toContain(value);
      expect(visible, value).toContain(value.replace(/\s+/g, ' '));
    }
    // Both versions give the link, and the expiry sentence in the same words.
    expect(text).toContain(URL_);
    expect(html).toContain(URL_.replaceAll('&', '&amp;'));
    // The trial-ended email has no countdown; every other one says how long is left in the same words.
    if (template !== 'trialEnded') {
      const expiry = /(\d+) (hours?|horas?)/.exec(text)?.[0];
      expect(expiry).toBeDefined();
      expect(visible).toContain(expiry);
    }
  });

  it('puts the language on the document', () => {
    expect(renderEmail('verifyEmail', locale, DATA).html).toContain(`<html lang="${locale}">`);
  });
});

describe('renderEmail content rules', () => {
  it('speaks Portuguese to a Portuguese user and English to an English one', () => {
    expect(renderEmail('verifyEmail', 'pt-BR', DATA).subject).toBe(
      'Confirme seu endereço de e-mail',
    );
    expect(renderEmail('verifyEmail', 'en', DATA).subject).toBe('Confirm your email address');
  });

  it('says how long the link lasts, with the right plural', () => {
    expect(renderEmail('resetPassword', 'en', { ...DATA, expiresInHours: 1 }).text).toContain(
      'expires in 1 hour.',
    );
    expect(renderEmail('resetPassword', 'en', { ...DATA, expiresInHours: 24 }).text).toContain(
      'expires in 24 hours.',
    );
    expect(renderEmail('resetPassword', 'pt-BR', { ...DATA, expiresInHours: 1 }).text).toContain(
      'expira em 1 hora.',
    );
    // Short test lifetimes still read as "1 hour", never "0 hours".
    expect(renderEmail('resetPassword', 'en', { ...DATA, expiresInHours: 0.01 }).text).toContain(
      '1 hour',
    );
  });

  it.each(TEMPLATES)(
    '%s has no remote images, tracking or scripts, and exactly one destination',
    (template) => {
      const { html } = renderEmail(template, 'en', DATA);
      expect(html).not.toMatch(/<img|<script|<iframe|<link|<style|src=|url\(|@import/i);
      const targets = [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1]);
      expect(new Set(targets)).toEqual(new Set([URL_.replaceAll('&', '&amp;')]));
    },
  );

  it('escapes anything that goes into the HTML', () => {
    const { html, text } = renderEmail('verifyEmail', 'en', {
      url: 'https://app.example.test/x?a=1&b="2"',
      name: '<script>alert(1)</script> & "co"',
      expiresInHours: 1,
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;');
    expect(html).toContain('href="https://app.example.test/x?a=1&amp;b=&quot;2&quot;"');
    // The text version is not HTML: the name stays as written.
    expect(text).toContain('<script>alert(1)</script> & "co"');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    'ftp://example.test/x',
    'not a url',
    '//evil.example/x',
  ])('refuses the link %s', (url) => {
    expect(() => renderEmail('verifyEmail', 'en', { ...DATA, url })).toThrow(TypeError);
  });

  it.each(['trialEnding', 'trialEnded'] as const)(
    '%s names the person’s own trip in the subject and the body, escaped in the HTML',
    (template) => {
      for (const locale of SUPPORTED_LOCALES) {
        const copy = catalogs[locale].email[template];
        const { subject, text, html } = renderEmail(template, locale, {
          ...DATA,
          tripTitle: 'Tokyo <3 & Kyoto',
        });
        expect(subject).toBe(copy.subjectTrip.replace('{trip}', 'Tokyo <3 & Kyoto'));
        expect(text).toContain(copy.trip.replace('{trip}', 'Tokyo <3 & Kyoto'));
        expect(html).toContain('Tokyo &lt;3 &amp; Kyoto');
        expect(html).not.toContain('Tokyo <3');
      }
    },
  );

  it('keeps a trip title on one line, so it cannot split the subject header', () => {
    const { subject } = renderEmail('trialEnding', 'en', {
      ...DATA,
      tripTitle: 'Rome\r\nBcc: someone@example.com',
    });
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it('never names a trip in account emails', () => {
    const { subject, text } = renderEmail('verifyEmail', 'en', { ...DATA, tripTitle: 'Rome' });
    expect(subject).toBe(catalogs.en.email.verifyEmail.subject);
    expect(text).not.toContain('Rome');
  });
});
