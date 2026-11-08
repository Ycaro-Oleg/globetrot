/* global document */
// Drives the built web app in a real browser, against a small stand-in for the API, to check what unit tests
// cannot: that every account screen and state is reachable, works from the keyboard, redirects safely, and has
// no WCAG 2.1 A/AA violation found by axe in both themes and both languages.
//
//   pnpm turbo run build --filter=@globetrot/web && pnpm --filter @globetrot/web test:a11y
//
// The stand-in API answers exactly like the real one for the cases the screens handle (stable error codes,
// `Retry-After`, the session cookie). The real flows against Postgres and Mailpit are covered by the API
// integration tests.
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import en from '../../../packages/i18n/messages/en.json' with { type: 'json' };
import ptBR from '../../../packages/i18n/messages/pt-BR.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const standalone = resolve(webRoot, '.next/standalone/apps/web');
if (!existsSync(resolve(standalone, 'server.js'))) {
  throw new Error('Build the web app first: pnpm turbo run build --filter=@globetrot/web');
}

const CATALOGS = { en, 'pt-BR': ptBR };
const PASSWORD = 'correct horse battery';
const SESSION = 'globetrot.session_token=ok';

// ---------------------------------------------------------------------------------------------------------
// A stand-in for the API.
// ---------------------------------------------------------------------------------------------------------
const USER = { id: 'u1', email: 'ana@example.com', name: 'Ana', emailVerified: true };
const PREFERENCES = {
  // Set per scenario: a signed-in user's stored language is the one the pages use.
  locale: 'en',
  currency: 'USD',
  homeCountry: null,
  nationality: null,
  timeZone: null,
  units: 'metric',
};

function reply(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

const readBody = (request) =>
  new Promise((done) => {
    let data = '';
    request.on('data', (chunk) => (data += chunk));
    request.on('end', () => {
      try {
        done(data ? JSON.parse(data) : {});
      } catch {
        done({});
      }
    });
  });

const stub = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://stub');
  const signedIn = (request.headers.cookie ?? '').includes(SESSION);
  const body = request.method === 'POST' ? await readBody(request) : {};
  const route = `${request.method} ${url.pathname}`;

  if (route === 'GET /v1/auth/providers') return reply(response, 200, { providers: ['google'] });
  if (route === 'GET /v1/me') {
    return signedIn
      ? reply(response, 200, USER)
      : reply(response, 401, { code: 'UNAUTHENTICATED' });
  }
  if (route === 'GET /v1/me/preferences') {
    return signedIn
      ? reply(response, 200, PREFERENCES)
      : reply(response, 401, { code: 'UNAUTHENTICATED' });
  }
  if (route === 'POST /api/auth/sign-in/email') {
    if (body.email === 'unverified@example.com')
      return reply(response, 403, { code: 'EMAIL_NOT_VERIFIED' });
    if (body.email === USER.email && body.password === PASSWORD) {
      return reply(
        response,
        200,
        { token: 'ok' },
        { 'set-cookie': `${SESSION}; Path=/; HttpOnly; SameSite=Lax` },
      );
    }
    return reply(response, 401, { code: 'INVALID_EMAIL_OR_PASSWORD' });
  }
  if (route === 'POST /api/auth/sign-up/email') {
    if (body.email === 'taken@example.com') {
      return reply(response, 422, { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' });
    }
    return reply(response, 200, { token: null, user: USER });
  }
  if (route === 'POST /api/auth/send-verification-email')
    return reply(response, 200, { status: true });
  if (route === 'POST /api/auth/request-password-reset')
    return reply(response, 200, { status: true });
  if (route === 'POST /api/auth/reset-password') {
    return body.token === 'good-token'
      ? reply(response, 200, { status: true })
      : reply(response, 400, { code: 'INVALID_TOKEN' });
  }
  if (route === 'POST /api/auth/sign-out') {
    return reply(
      response,
      200,
      { success: true },
      { 'set-cookie': 'globetrot.session_token=; Path=/; Max-Age=0' },
    );
  }
  return reply(response, 404, { code: 'NOT_FOUND' });
});
await new Promise((listening) => stub.listen(0, '127.0.0.1', listening));
const stubPort = stub.address().port;

// ---------------------------------------------------------------------------------------------------------
// The web app, as the Docker image runs it.
// ---------------------------------------------------------------------------------------------------------
cpSync(resolve(webRoot, '.next/static'), resolve(standalone, '.next/static'), { recursive: true });
if (existsSync(resolve(webRoot, 'public'))) {
  cpSync(resolve(webRoot, 'public'), resolve(standalone, 'public'), { recursive: true });
}
const webPort = 3300 + Math.floor(Math.random() * 400);
const base = `http://127.0.0.1:${webPort}`;
const web = spawn('node', ['server.js'], {
  cwd: standalone,
  env: {
    ...process.env,
    PORT: String(webPort),
    HOSTNAME: '127.0.0.1',
    API_INTERNAL_URL: `http://127.0.0.1:${stubPort}`,
    NODE_ENV: 'production',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let webLog = '';
web.stdout.on('data', (chunk) => (webLog += chunk));
web.stderr.on('data', (chunk) => (webLog += chunk));

async function shutdown() {
  web.kill();
  await new Promise((closed) => stub.close(closed));
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${base}/login`)).ok) break;
    } catch {
      /* not up yet */
    }
    if (attempt > 60) throw new Error(`The web app did not start:\n${webLog}`);
    await new Promise((wait) => setTimeout(wait, 500));
  }

  browser = await chromium.launch({ headless: true });

  /** A fresh browser context in a language, optionally already signed in. */
  async function open(locale, { signedIn = false } = {}) {
    PREFERENCES.locale = locale;
    const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, locale });
    await context.addCookies([
      { name: 'globetrot_locale', value: locale, url: base },
      ...(signedIn ? [{ name: 'globetrot.session_token', value: 'ok', url: base }] : []),
    ]);
    const page = await context.newPage();
    return { context, page };
  }

  /**
   * Opens a page and waits until it has hydrated. A click before hydration would submit the form natively and
   * reload the page, which no person on a normal connection can do but a script can.
   */
  async function go(page, url) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
  }

  const field = (page, label) => page.getByLabel(label, { exact: true });
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const fillEmail = async (page, copy, value) => field(page, copy.email).fill(value);

  // -------------------------------------------------------------------------------------------------------
  // Every screen and state, in both languages and both themes, through axe.
  // -------------------------------------------------------------------------------------------------------
  /** name, whether the visitor is signed in, and how to reach the state. */
  const scenarios = (copy) => [
    ['login', false, async (page) => go(page, `${base}/login`)],
    [
      'login-empty-submit',
      false,
      async (page) => {
        await go(page, `${base}/login`);
        await button(page, copy.login.submit).click();
        await page.getByRole('alert').filter({ hasText: copy.errors.summary }).waitFor();
      },
    ],
    [
      'login-bad-credentials',
      false,
      async (page) => {
        await go(page, `${base}/login`);
        await fillEmail(page, copy, 'ana@example.com');
        await field(page, copy.password).fill('not the password');
        await button(page, copy.login.submit).click();
        await page.getByText(copy.errors.invalidCredentials).waitFor();
      },
    ],
    [
      'login-unverified',
      false,
      async (page) => {
        await go(page, `${base}/login`);
        await fillEmail(page, copy, 'unverified@example.com');
        await field(page, copy.password).fill(PASSWORD);
        await button(page, copy.login.submit).click();
        await page.getByText(copy.errors.notVerified).waitFor();
      },
    ],
    ['signup', false, async (page) => go(page, `${base}/signup`)],
    [
      'signup-empty-submit',
      false,
      async (page) => {
        await go(page, `${base}/signup`);
        await button(page, copy.signup.submit).click();
        await page.getByText(copy.errors.requiredTerms).waitFor();
      },
    ],
    [
      'signup-strength-meter',
      false,
      async (page) => {
        await go(page, `${base}/signup`);
        await field(page, copy.password).fill('correct horse battery staple');
        await page.getByText(`${copy.strength.label}: ${copy.strength.strong}`).waitFor();
      },
    ],
    [
      'signup-duplicate-email',
      false,
      async (page) => {
        await go(page, `${base}/signup`);
        await field(page, copy.firstName).fill('Ana');
        await fillEmail(page, copy, 'taken@example.com');
        await field(page, copy.password).fill('correct horse battery staple');
        await page.locator('.gt-checkbox .gt-choice__mark').click();
        await button(page, copy.signup.submit).click();
        await page.getByText(copy.errors.emailTaken).waitFor();
      },
    ],
    [
      'signup-check-your-inbox',
      false,
      async (page) => {
        await go(page, `${base}/signup`);
        await field(page, copy.firstName).fill('Ana');
        await fillEmail(page, copy, 'new@example.com');
        await field(page, copy.password).fill('correct horse battery staple');
        await page.locator('.gt-checkbox .gt-choice__mark').click();
        await button(page, copy.signup.submit).click();
        await page.getByRole('heading', { name: copy.signup.sentTitle }).waitFor();
      },
    ],
    ['recover', false, async (page) => go(page, `${base}/recover`)],
    [
      'recover-check-your-inbox',
      false,
      async (page) => {
        await go(page, `${base}/recover`);
        await fillEmail(page, copy, 'ana@example.com');
        await button(page, copy.recover.submit).click();
        await page.getByRole('heading', { name: copy.recover.sentTitle }).waitFor();
      },
    ],
    ['reset-form', false, async (page) => go(page, `${base}/reset-password?token=good-token`)],
    [
      'reset-bad-link',
      false,
      async (page) => go(page, `${base}/reset-password?error=INVALID_TOKEN`),
    ],
    [
      'reset-done',
      false,
      async (page) => {
        await go(page, `${base}/reset-password?token=good-token`);
        await field(page, copy.newPassword).fill('a brand new passphrase');
        await button(page, copy.reset.submit).click();
        await page.getByText(copy.reset.done).waitFor();
      },
    ],
    ['email-verified', true, async (page) => go(page, `${base}/email-verified`)],
    [
      'email-verified-bad-link',
      false,
      async (page) => go(page, `${base}/email-verified?error=token_expired`),
    ],
    ['terms-draft', false, async (page) => go(page, `${base}/terms`)],
    ['privacy-draft', false, async (page) => go(page, `${base}/privacy`)],
    ['app-home', true, async (page) => go(page, `${base}/app`)],
  ];

  for (const locale of ['en', 'pt-BR']) {
    const copy = CATALOGS[locale].auth;
    for (const theme of ['day', 'red-eye']) {
      for (const [name, signedIn, reach] of scenarios(copy)) {
        const { context, page } = await open(locale, { signedIn });
        try {
          await reach(page);
          // Debugging aid: DUMP_SCENARIO=<name> prints the page's HTML for that state.
          if (process.env.DUMP_SCENARIO === name && theme === 'day' && locale === 'en') {
            console.log(await page.evaluate(() => document.body.innerHTML));
          }
          await page.evaluate(
            (value) => document.documentElement.setAttribute('data-theme', value),
            theme,
          );
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          for (const violation of results.violations) {
            if (process.env.DUMP_SCENARIO === name && theme === 'day' && locale === 'en') {
              console.log(
                await page.evaluate(() => {
                  const img = document.querySelector('[role="img"]');
                  return img
                    ? `PARENT: ${img.parentElement?.outerHTML.slice(0, 600)} | ID TARGET: ${img.getAttribute('aria-labelledby')} -> ${document.getElementById(img.getAttribute('aria-labelledby') ?? '')?.outerHTML}`
                    : 'no img now';
                }),
              );
            }
            const where = violation.nodes
              .map((node) => `${node.target.join(' ')} ${node.html.slice(0, 140)}`)
              .join(' | ');
            failures.push(`axe ${theme}/${locale}/${name}: ${violation.id} (${where})`);
          }
          check(
            (await page.locator('html').getAttribute('lang')) === locale,
            `${locale}/${name}: <html lang> is not ${locale}`,
          );
        } catch (error) {
          failures.push(
            `${theme}/${locale}/${name}: could not reach the state (${error.message.split('\n')[0]})`,
          );
        } finally {
          await context.close();
        }
      }
    }
  }

  // -------------------------------------------------------------------------------------------------------
  // Behavior, in English.
  // -------------------------------------------------------------------------------------------------------
  const copy = CATALOGS.en.auth;

  {
    // Sign-in works from the keyboard alone, and lands on /app.
    const { context, page } = await open('en');
    await go(page, `${base}/login`);
    await field(page, copy.email).focus();
    await page.keyboard.type('ana@example.com');
    await page.keyboard.press('Tab');
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForURL(`${base}/app`, { timeout: 10_000 }).catch(() => {});
    check(
      page.url() === `${base}/app`,
      `keyboard-only login did not land on /app (at ${page.url()})`,
    );
    check(
      await page.getByText('Hi, Ana!').isVisible(),
      'the app page does not greet the user by name',
    );
    await context.close();
  }

  {
    // Empty submit: both field errors, a summary announced as an alert, focus on the first problem.
    const { context, page } = await open('en');
    await go(page, `${base}/login`);
    await button(page, copy.login.submit).click();
    await page.getByText(copy.errors.requiredEmail).waitFor();
    check(
      await page.getByText(copy.errors.requiredPassword).isVisible(),
      'login: password error missing',
    );
    check(
      (await page.getByRole('alert').filter({ hasText: copy.errors.summary }).count()) === 1,
      'login: the error summary is not announced as an alert',
    );
    check(
      (await page.evaluate(() => document.activeElement?.getAttribute('name'))) === 'email',
      'login: focus did not move to the first invalid field',
    );
    await context.close();
  }

  {
    // Bad credentials: one generic banner, no hint about which part was wrong.
    const { context, page } = await open('en');
    await go(page, `${base}/login`);
    await fillEmail(page, copy, 'ana@example.com');
    await field(page, copy.password).fill('wrong password');
    await button(page, copy.login.submit).click();
    await page.getByText(copy.errors.invalidCredentials).waitFor();
    check(
      (await page
        .getByRole('alert')
        .filter({ hasText: copy.errors.invalidCredentials })
        .count()) === 1,
      'login: the credentials error is not an alert',
    );
    await context.close();
  }

  {
    // Unverified address: the message and a resend button that counts down.
    const { context, page } = await open('en');
    await go(page, `${base}/login`);
    await fillEmail(page, copy, 'unverified@example.com');
    await field(page, copy.password).fill(PASSWORD);
    await button(page, copy.login.submit).click();
    await page.getByText(copy.errors.notVerified).waitFor();
    await button(page, copy.resend.action).click();
    await page.getByText(copy.resend.sent).waitFor();
    check(
      await page.getByRole('button', { name: /Send again in \d+s/ }).isDisabled(),
      'resend: the button is not disabled during the countdown',
    );
    await context.close();
  }

  {
    // The next parameter only ever leads to this site.
    for (const [next, expected] of [
      ['https://evil.example', '/app'],
      ['//evil.example', '/app'],
      ['/\\evil.example', '/app'],
      ['/settings', '/settings'],
    ]) {
      const { context, page } = await open('en');
      await go(page, `${base}/login?next=${encodeURIComponent(next)}`);
      await fillEmail(page, copy, 'ana@example.com');
      await field(page, copy.password).fill(PASSWORD);
      await button(page, copy.login.submit).click();
      await page
        .waitForURL((url) => url.pathname === expected, { timeout: 10_000 })
        .catch(() => {});
      const landed = new URL(page.url());
      check(
        landed.origin === base && landed.pathname === expected,
        `login?next=${next} landed on ${page.url()} instead of ${expected}`,
      );
      await context.close();
    }
  }

  {
    // An anonymous visit to the app goes to log in, remembering the page.
    const { context, page } = await open('en');
    await go(page, `${base}/app`);
    check(
      new URL(page.url()).pathname === '/login' &&
        new URL(page.url()).searchParams.get('next') === '/app',
      `anonymous /app did not go to /login?next=/app (at ${page.url()})`,
    );
    await context.close();
  }

  {
    // Sign-up: the strength meter, the required terms, the duplicate email with a way to log in, the success state.
    const { context, page } = await open('en');
    await go(page, `${base}/signup`);
    await field(page, copy.password).fill('abcdefgh');
    await page.getByText(`${copy.strength.label}: ${copy.strength.weak}`).waitFor();
    await field(page, copy.password).fill('correct horse battery staple');
    await page.getByText(`${copy.strength.label}: ${copy.strength.strong}`).waitFor();
    check(
      (await page.locator('[aria-live="polite"]', { hasText: copy.strength.label }).count()) > 0,
      'sign up: the strength is not in a polite live region',
    );

    await field(page, copy.firstName).fill('Ana');
    await fillEmail(page, copy, 'taken@example.com');
    await button(page, copy.signup.submit).click();
    await page.getByText(copy.errors.requiredTerms).waitFor();

    await page.locator('.gt-checkbox .gt-choice__mark').click();
    await button(page, copy.signup.submit).click();
    await page.getByText(copy.errors.emailTaken).waitFor();
    check(
      (await page.getByRole('link', { name: copy.signup.toLogin }).count()) >= 1,
      'sign up: a duplicate email does not offer a link to log in',
    );

    await fillEmail(page, copy, 'new@example.com');
    await button(page, copy.signup.submit).click();
    await page.getByRole('heading', { name: copy.signup.sentTitle }).waitFor();
    check(
      await page.getByRole('button', { name: /Send again in \d+s/ }).isDisabled(),
      'sign up: the resend button does not start disabled with a countdown',
    );
    await context.close();
  }

  {
    // Recovery: the same success state whatever the address, and an expired reset link.
    const { context, page } = await open('en');
    await go(page, `${base}/recover`);
    await fillEmail(page, copy, 'nobody@example.com');
    await button(page, copy.recover.submit).click();
    await page.getByRole('heading', { name: copy.recover.sentTitle }).waitFor();
    await context.close();

    const bad = await open('en');
    await go(bad.page, `${base}/reset-password?token=stale-token`);
    await field(bad.page, copy.newPassword).fill('a brand new passphrase');
    await button(bad.page, copy.reset.submit).click();
    await bad.page.getByText(copy.errors.invalidToken).waitFor();
    check(
      (await bad.page.getByRole('link', { name: copy.reset.requestNew }).count()) === 1,
      'reset: an expired link does not offer to ask for a new one',
    );
    await bad.context.close();
  }

  {
    // The language switcher changes the language and nothing else.
    const { context, page } = await open('en');
    await go(page, `${base}/login`);
    await page.getByRole('button', { name: 'Português (Brasil)' }).click();
    await page.getByRole('heading', { name: CATALOGS['pt-BR'].auth.login.title }).waitFor();
    check(
      (await page.locator('html').getAttribute('lang')) === 'pt-BR',
      'switcher: <html lang> did not change',
    );
    await context.close();
  }

  {
    // Signing out ends up on the log-in page.
    const { context, page } = await open('en', { signedIn: true });
    await go(page, `${base}/app`);
    await button(page, CATALOGS.en.app.signOut).click();
    await page.waitForURL(`${base}/login`, { timeout: 10_000 }).catch(() => {});
    check(
      new URL(page.url()).pathname === '/login',
      `sign out did not go to /login (at ${page.url()})`,
    );
    await context.close();
  }
} finally {
  await browser?.close();
  await shutdown();
}

if (failures.length > 0) {
  console.error(`${failures.length} problem(s) on the account screens:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    'Account screens: every state reachable, keyboard path works, redirects safe, axe clean (2 themes x 2 languages).',
  );
}
