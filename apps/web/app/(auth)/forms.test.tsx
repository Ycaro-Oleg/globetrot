import { catalogs, SUPPORTED_LOCALES, type SupportedLocale } from '@globetrot/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Only needed on submit or navigation; keep Next's runtime out of the render tests.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock('../actions', () => ({ setScaffoldLocale: vi.fn() }));

import { LanguageSwitcher } from './_components/language-switcher';
import { LoginForm } from './_components/login-form';
import { RecoverForm } from './_components/recover-form';
import { ResendForm } from './_components/resend-form';
import { ResetForm } from './_components/reset-form';
import { SignupForm } from './_components/signup-form';

function render(locale: SupportedLocale, element: ReactElement): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

/** What a reader sees. */
const visible = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&#x27;', "'")
    .replace(/\s+/g, ' ')
    .trim();

describe.each(SUPPORTED_LOCALES)('auth screens in %s', (locale) => {
  const copy = catalogs[locale].auth;

  it('log in: title, fields, forgot link, submit and the way to sign up', () => {
    const html = render(locale, <LoginForm next="/app" googleEnabled={false} />);
    const text = visible(html);
    for (const expected of [
      copy.login.title,
      copy.email,
      copy.password,
      copy.login.forgot,
      copy.login.submit,
      copy.login.noAccount,
      copy.login.toSignup,
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(html).toContain('href="/recover"');
    expect(html).toContain('href="/signup"');
    expect(html).toContain('type="password"');
    expect(html).toMatch(/autocomplete="current-password"/i);
  });

  it('log in: the Google button is there only when the API offers it', () => {
    const without = render(locale, <LoginForm next="/app" googleEnabled={false} />);
    const withGoogle = render(locale, <LoginForm next="/app" googleEnabled />);
    expect(visible(without)).not.toContain(copy.google);
    expect(visible(withGoogle)).toContain(copy.google);
    expect(visible(withGoogle)).toContain(copy.or);
  });

  it('sign up: every field, the password hint, the terms with real links, and the submit', () => {
    const html = render(locale, <SignupForm next="/app" googleEnabled={false} />);
    const text = visible(html);
    for (const expected of [
      copy.signup.title,
      copy.firstName,
      copy.email,
      copy.password,
      copy.signup.submit,
      copy.signup.haveAccount,
      copy.signup.toLogin,
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(text).toContain(copy.signup.passwordHint.replace('{min, number}', '8'));
    for (const page of ['/terms', '/privacy']) {
      const tag = new RegExp(`<a[^>]*href="${page}"[^>]*>`).exec(html)?.[0];
      expect(tag, page).toBeDefined();
      expect(tag).toContain('rel="noopener"');
      expect(tag).toContain('target="_blank"');
    }
    expect(html).toMatch(/autocomplete="new-password"/i);
  });

  it('recover: explains itself, asks for the email and offers the way back', () => {
    const html = render(locale, <RecoverForm />);
    const text = visible(html);
    for (const expected of [
      copy.recover.title,
      copy.recover.intro,
      copy.email,
      copy.recover.submit,
    ]) {
      expect(text, expected).toContain(expected);
    }
    expect(html).toContain('href="/login"');
  });

  it('reset: the new-password form for a good token', () => {
    const html = render(locale, <ResetForm token="abc" tokenProblem={false} />);
    const text = visible(html);
    expect(text).toContain(copy.reset.title);
    expect(text).toContain(copy.newPassword);
    expect(text).toContain(copy.reset.submit);
    expect(html).not.toContain('role="alert"');
  });

  it.each([
    ['a missing token', null, false],
    ['a token the server rejected', 'abc', true],
  ])(
    'reset: %s shows the problem and a way to ask again, not the form',
    (_name, token, problem) => {
      const html = render(locale, <ResetForm token={token} tokenProblem={problem} />);
      const text = visible(html);
      expect(text).toContain(copy.errors.invalidToken);
      expect(html).toContain('role="alert"');
      expect(html).toContain('href="/recover"');
      expect(text).toContain(copy.reset.requestNew);
      expect(html).not.toContain('type="password"');
    },
  );

  it('resend form: asks for the email', () => {
    const text = visible(render(locale, <ResendForm />));
    expect(text).toContain(copy.email);
    expect(text).toContain(copy.verified.sendNew);
  });

  it('language switcher: both names, the current one pressed, nothing about currency or country', () => {
    const html = render(locale, <LanguageSwitcher />);
    expect(visible(html)).toContain('English');
    expect(visible(html)).toContain('Português (Brasil)');
    expect(html).toMatch(
      new RegExp(
        `value="${locale}"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*value="${locale}"`,
      ),
    );
    expect(visible(html)).not.toMatch(/[$€£¥]|\b(USD|BRL|EUR)\b/);
  });
});

describe('auth screens carry no stray text', () => {
  it('every visible string comes from the catalog: the two languages differ everywhere', () => {
    const screens: [string, ReactElement][] = [
      ['login', <LoginForm key="l" next="/app" googleEnabled />],
      ['signup', <SignupForm key="s" next="/app" googleEnabled />],
      ['recover', <RecoverForm key="r" />],
    ];
    for (const [name, element] of screens) {
      expect(visible(render('en', element)), name).not.toBe(visible(render('pt-BR', element)));
    }
  });
});
