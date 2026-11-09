/* global document, window, getComputedStyle */
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
// The shell changes layout at 720 and 1100 wide; 320 is the narrowest phone worth supporting.
const VIEWPORTS = {
  narrow: { width: 320, height: 640 },
  phone: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  laptop: { width: 1100, height: 800 },
  desktop: { width: 1440, height: 900 },
};
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

const NOW = '2026-11-08T12:00:00.000Z';
const TRIPS = [
  {
    id: '01a1c28d-afc9-7767-af40-c937c80dd9dc',
    title: 'Japan 2027',
    startDate: '2027-04-10',
    currency: 'JPY',
    status: 'active',
    visibility: 'private',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: '01a1c28d-afc9-7767-af40-c937c80dd9dd',
    title: 'Lisbon weekend',
    startDate: null,
    currency: 'EUR',
    status: 'archived',
    visibility: 'private',
    createdAt: NOW,
    updatedAt: NOW,
  },
];
const TRIP_ID = TRIPS[0].id;

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
  if (route === 'GET /v1/trips') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    const all = url.searchParams.get('includeArchived') === 'true';
    return reply(response, 200, {
      trips: TRIPS.filter((trip) => all || trip.status !== 'archived'),
    });
  }
  if (route === 'POST /v1/trips') {
    return signedIn
      ? reply(response, 201, { ...TRIPS[0], title: String(body.title ?? 'New trip') })
      : reply(response, 401, { code: 'UNAUTHENTICATED' });
  }
  const tripRoute = /^\/v1\/trips\/([^/]+)$/.exec(url.pathname);
  if (tripRoute && request.method === 'GET') {
    const found = TRIPS.find((trip) => trip.id === tripRoute[1]);
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return found ? reply(response, 200, found) : reply(response, 404, { code: 'NOT_FOUND' });
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
let webLog = '';
/** Starts the built app as the Docker image runs it, with the API pointed at the stand-in. */
function launch(extraEnv = {}) {
  const port = 3300 + Math.floor(Math.random() * 400);
  const child = spawn('node', ['server.js'], {
    cwd: standalone,
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      API_INTERNAL_URL: `http://127.0.0.1:${stubPort}`,
      NODE_ENV: 'production',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => (webLog += chunk));
  child.stderr.on('data', (chunk) => (webLog += chunk));
  return { child, url: `http://127.0.0.1:${port}` };
}

async function waitUntilUp(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      if ((await fetch(`${url}/login`)).ok) return;
    } catch {
      /* not up yet */
    }
    if (attempt > 60) throw new Error(`The web app did not start:\n${webLog}`);
    await new Promise((wait) => setTimeout(wait, 500));
  }
}

// The main app has Pip switched off (the default); a second copy has the flag on, to check both states.
const main = launch();
const withPip = launch({ FEATURE_PIP: 'true' });
const base = main.url;
const pipBase = withPip.url;

async function shutdown() {
  main.child.kill();
  withPip.child.kill();
  await new Promise((closed) => stub.close(closed));
}

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

let browser;
try {
  await waitUntilUp(base);
  await waitUntilUp(pipBase);

  browser = await chromium.launch({ headless: true });

  /** A fresh browser context in a language, optionally already signed in. */
  async function open(locale, { signedIn = false, viewport = VIEWPORTS.laptop } = {}) {
    PREFERENCES.locale = locale;
    const context = await browser.newContext({ viewport, locale });
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
    ...shellScenarios(copy),
    ...publicScenarios(),
    ...tripScenarios(copy),
  ];

  /** The public landing page, at the three layouts. */
  function publicScenarios() {
    return ['phone', 'tablet', 'desktop'].map((layout) => [
      `landing-${layout}`,
      false,
      async (page) => go(page, `${base}/`),
      VIEWPORTS[layout],
    ]);
  }

  /** The trip screens: list, filters, create form, overview, unknown trip, and the switcher open. */
  function tripScenarios(copy) {
    const tripCopy = CATALOGS[copy === CATALOGS.en.auth ? 'en' : 'pt-BR'].tripWorkspace;
    const entries = [];
    for (const layout of ['phone', 'desktop']) {
      entries.push([
        `trips-list-${layout}`,
        true,
        async (page) => go(page, `${base}/app/trips`),
        VIEWPORTS[layout],
      ]);
      entries.push([
        `trip-overview-${layout}`,
        true,
        async (page) => go(page, `${base}/app/trips/${TRIP_ID}`),
        VIEWPORTS[layout],
      ]);
    }
    entries.push([
      'trips-archived-desktop',
      true,
      async (page) => go(page, `${base}/app/trips?filter=archived`),
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'trip-unknown-desktop',
      true,
      async (page) => go(page, `${base}/app/trips/01a1c28d-afc9-7767-af40-c937c80dd9ee`),
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'trips-create-open-desktop',
      true,
      async (page) => {
        await go(page, `${base}/app/trips`);
        await page.locator('main summary').first().click();
        await page.locator('form#create-trip-form-body input[name=title]').waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'trip-switcher-open-desktop',
      true,
      async (page) => {
        await go(page, `${base}/app/trips`);
        await page.locator('summary', { hasText: tripCopy.switcher.label }).first().click();
        await page
          .getByRole('button', { name: /Japan 2027/ })
          .first()
          .waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    return entries;
  }

  /** The signed-in shell: each layout, the placeholder pages, the open account menu, and Pip switched on. */
  function shellScenarios(copy) {
    const shellCopy = CATALOGS[copy === CATALOGS.en.auth ? 'en' : 'pt-BR'].shell;
    const menuLabel = shellCopy.account.menu.replace('{name}', USER.name);
    const openMenu = async (page) => {
      await page.getByRole('button', { name: menuLabel }).click();
      await page.getByRole('link', { name: shellCopy.account.settings }).waitFor();
    };
    const at = (path, viewport, origin = base) => [
      async (page) => go(page, `${origin}${path}`),
      viewport,
    ];
    const entries = [];
    for (const layout of ['narrow', 'phone', 'tablet', 'laptop', 'desktop']) {
      entries.push([`shell-home-${layout}`, true, ...at('/app', VIEWPORTS[layout])]);
    }
    for (const section of ['board', 'days', 'budget', 'lists', 'trips', 'passport', 'more']) {
      entries.push([`shell-${section}-phone`, true, ...at(`/app/${section}`, VIEWPORTS.phone)]);
    }
    entries.push(['shell-budget-desktop', true, ...at('/app/budget', VIEWPORTS.desktop)]);
    entries.push([
      'shell-pip-off-404',
      true,
      async (page) => {
        const response = await page.goto(`${base}/app/pip`);
        await page.waitForLoadState('networkidle');
        if (response?.status() !== 404) {
          throw new Error(`/app/pip answered ${response?.status()} with the flag off`);
        }
      },
      VIEWPORTS.phone,
    ]);
    entries.push(['shell-pip-home-phone', true, ...at('/app', VIEWPORTS.phone, pipBase)]);
    entries.push(['shell-pip-home-desktop', true, ...at('/app', VIEWPORTS.desktop, pipBase)]);
    entries.push(['shell-pip-page', true, ...at('/app/pip', VIEWPORTS.phone, pipBase)]);
    for (const layout of ['desktop', 'phone']) {
      entries.push([
        `shell-menu-open-${layout}`,
        true,
        async (page) => {
          await go(page, `${base}/app`);
          await openMenu(page);
        },
        VIEWPORTS[layout],
      ]);
    }
    return entries;
  }

  for (const locale of ['en', 'pt-BR']) {
    const copy = CATALOGS[locale].auth;
    for (const theme of ['day', 'red-eye']) {
      for (const [name, signedIn, reach, viewport] of scenarios(copy)) {
        // Debugging aid: AXE_ONLY=<regex> runs only the matching scenarios (and skips the behavior checks).
        if (process.env.AXE_ONLY && !new RegExp(process.env.AXE_ONLY).test(name)) continue;
        const { context, page } = await open(locale, { signedIn, viewport });
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
              .map(
                (node) =>
                  `${node.target.join(' ')} ${node.html.slice(0, 140)} [${(node.any[0]?.message ?? '').slice(0, 170)}]`,
              )
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

  if (process.env.AXE_ONLY) {
    await browser.close();
    await shutdown();
    for (const failure of failures) console.error(`  - ${failure}`);
    console.error(
      `${failures.length} problem(s) in the scenarios matching ${process.env.AXE_ONLY}`,
    );
    process.exit(failures.length > 0 ? 1 : 0);
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
    // /app is the entry point and sends a signed-in visitor to the board.
    await page.waitForURL(`${base}/app/board`, { timeout: 10_000 }).catch(() => {});
    check(
      page.url() === `${base}/app/board`,
      `keyboard-only login did not land on the board (at ${page.url()})`,
    );
    const boardHeading = page.getByRole('heading', { name: CATALOGS.en.mapBoard.title, level: 1 });
    await boardHeading.waitFor({ timeout: 10_000 }).catch(() => {});
    check(await boardHeading.isVisible(), 'the board page has no heading');
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

  // -------------------------------------------------------------------------------------------------------
  // The app shell: layout per screen size, navigation, keyboard, account menu, Pip flag.
  // -------------------------------------------------------------------------------------------------------
  {
    const shell = CATALOGS.en.shell;
    const accountLabel = shell.account.menu.replace('{name}', USER.name);
    const railNames = [
      shell.nav.home,
      shell.nav.trips,
      shell.nav.board,
      shell.nav.days,
      shell.nav.budget,
      shell.nav.lists,
      shell.nav.passport,
    ];
    const visibleNav = (page) => page.getByRole('navigation', { name: shell.nav.label });
    const linkNames = async (nav) => nav.getByRole('link').allInnerTexts();

    {
      // Desktop: a labelled rail of 248px and no tab bar.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app`);
      const nav = visibleNav(page);
      check((await nav.count()) === 1, 'desktop: expected exactly one visible navigation');
      const names = (await linkNames(nav)).map((name) => name.trim());
      check(
        JSON.stringify(names) === JSON.stringify(railNames),
        `desktop: the rail links are ${JSON.stringify(names)}`,
      );
      const rail = await page
        .locator('nav')
        .first()
        .evaluate((el) => el.parentElement.getBoundingClientRect().width);
      check(Math.round(rail) === 248, `desktop: the rail is ${rail}px wide, not 248`);
      await context.close();
    }

    {
      // Tablet: a rail of icons 76px wide; the labels are not drawn but the links keep their names.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.tablet });
      await go(page, `${base}/app`);
      const nav = visibleNav(page);
      check((await nav.count()) === 1, 'tablet: expected exactly one visible navigation');
      const rail = await page
        .locator('nav')
        .first()
        .evaluate((el) => el.parentElement.getBoundingClientRect().width);
      check(Math.round(rail) === 76, `tablet: the rail is ${rail}px wide, not 76`);
      for (const name of railNames) {
        check(
          (await nav.getByRole('link', { name, exact: true }).count()) === 1,
          `tablet: the "${name}" link lost its accessible name`,
        );
      }
      const box = await nav
        .getByRole('link', { name: shell.nav.budget, exact: true })
        .boundingBox();
      check(box !== null && box.width <= 76, 'tablet: the Budget link is wider than the rail');
      await context.close();
    }

    for (const locale of ['en', 'pt-BR']) {
      // Phone, down to 320px wide: a top bar, five tabs of at least 44px, nothing wider than the screen.
      const names = CATALOGS[locale].shell.nav;
      const tabs = [names.board, names.days, names.budget, names.lists, names.more];
      for (const viewport of [VIEWPORTS.narrow, VIEWPORTS.phone]) {
        for (const path of ['/app', '/app/board', '/app/budget', '/app/more']) {
          const { context, page } = await open(locale, { signedIn: true, viewport });
          await go(page, `${base}${path}`);
          const where = `phone ${viewport.width}px ${locale} ${path}`;
          const nav = page.getByRole('navigation', { name: CATALOGS[locale].shell.nav.label });
          check((await nav.count()) === 1, `${where}: expected exactly one visible navigation`);
          const found = (await nav.getByRole('link').allInnerTexts()).map((name) => name.trim());
          check(
            JSON.stringify(found) === JSON.stringify(tabs),
            `${where}: the tabs are ${JSON.stringify(found)}`,
          );
          for (const link of await nav.getByRole('link').all()) {
            const box = await link.boundingBox();
            check(
              box !== null && box.height >= 44 && box.width >= 44,
              `${where}: a tab is smaller than 44px`,
            );
            check(
              box !== null && box.x >= 0 && box.x + box.width <= viewport.width,
              `${where}: a tab sticks out of the screen`,
            );
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          check(overflow <= 0, `${where}: the page scrolls sideways by ${overflow}px`);
          // Scrolled to the end, the last line of content must not hide under the floating bar.
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          const bar = await nav.boundingBox();
          const contentBottom = await page.locator('main').evaluate((el) => {
            const last = el.lastElementChild;
            return last ? last.getBoundingClientRect().bottom : 0;
          });
          check(
            bar !== null && contentBottom <= bar.y + 1,
            `${where}: the content runs under the tab bar`,
          );
          await context.close();
        }
      }
    }

    {
      // The layout breaks exactly at 720 and 1100.
      const { context, page } = await open('en', {
        signedIn: true,
        viewport: { width: 719, height: 800 },
      });
      await go(page, `${base}/app`);
      // The phone layout is the one where the navigation floats at the bottom; from 720px it is a rail on the left.
      const phoneNav = await page
        .getByRole('navigation', { name: CATALOGS.en.shell.nav.label })
        .boundingBox();
      check(phoneNav !== null && phoneNav.y > 500, '719px: the tab bar is not at the bottom');
      await page.setViewportSize({ width: 720, height: 800 });
      const railNav = await page
        .getByRole('navigation', { name: CATALOGS.en.shell.nav.label })
        .boundingBox();
      check(
        railNav !== null && railNav.x < 100 && railNav.y < 300,
        '720px: the rail is not on the left',
      );
      const rail720 = await page
        .locator('nav')
        .first()
        .evaluate((el) => el.parentElement.getBoundingClientRect().width);
      check(Math.round(rail720) === 76, `720px: the rail is ${rail720}px, not 76`);
      await page.setViewportSize({ width: 1099, height: 800 });
      const rail1099 = await page
        .locator('nav')
        .first()
        .evaluate((el) => el.parentElement.getBoundingClientRect().width);
      check(Math.round(rail1099) === 76, `1099px: the rail is ${rail1099}px, not 76`);
      await page.setViewportSize({ width: 1100, height: 800 });
      const rail1100 = await page
        .locator('nav')
        .first()
        .evaluate((el) => el.parentElement.getBoundingClientRect().width);
      check(Math.round(rail1100) === 248, `1100px: the rail is ${rail1100}px, not 248`);
      await context.close();
    }

    {
      // Keyboard: the skip link is the first stop and moves focus to the content; focus is always visible.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app/budget`);
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
      check(first === shell.skipLink, `the first Tab stop is "${first}", not the skip link`);
      check(
        await page.getByText(shell.skipLink).isVisible(),
        'the skip link is not visible while focused',
      );
      await page.keyboard.press('Enter');
      const afterSkip = await page.evaluate(() => document.activeElement?.id);
      check(
        afterSkip === 'main',
        `the skip link left focus on "${afterSkip}", not the main region`,
      );
      // Walk the rail with Tab and make sure every stop draws a focus ring of the token width.
      await page.keyboard.press('Shift+Tab');
      for (let stop = 0; stop < 12; stop++) {
        await page.keyboard.press('Tab');
        const ring = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || el === document.body) return null;
          const style = getComputedStyle(el);
          return {
            width: parseFloat(style.outlineWidth),
            style: style.outlineStyle,
            tag: el.tagName,
          };
        });
        check(
          ring === null || (ring.style !== 'none' && ring.width >= 3),
          `a focused ${ring?.tag} has no 3px focus ring (${JSON.stringify(ring)})`,
        );
      }
      await context.close();
    }

    {
      // Navigation: the current page is marked, and following a link changes the page and the mark.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app`);
      const nav = visibleNav(page);
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === shell.nav.board,
        'Board is not the marked page after /app redirects to it',
      );
      await nav.getByRole('link', { name: shell.nav.budget, exact: true }).click();
      await page.waitForURL(`${base}/app/budget`);
      await page.getByRole('heading', { name: shell.nav.budget, level: 1 }).waitFor();
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === shell.nav.budget,
        'Budget is not the marked page on /app/budget',
      );
      check(
        await page.getByText(shell.comingSoon.budget).isVisible(),
        'the Budget placeholder does not say it is not built yet',
      );
      check(
        (await page.title()).startsWith(shell.nav.budget),
        `the Budget page title is "${await page.title()}"`,
      );
      await context.close();
    }

    {
      // Phone: More holds the rest and the current tab follows it.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.phone });
      await go(page, `${base}/app/more`);
      const nav = visibleNav(page);
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === shell.nav.more,
        'More is not the marked tab on /app/more',
      );
      for (const name of [
        shell.nav.home,
        shell.nav.trips,
        shell.nav.passport,
        shell.nav.settings,
      ]) {
        check(
          (await page.locator('main').getByRole('link', { name, exact: true }).count()) === 1,
          `More does not list "${name}"`,
        );
      }
      await page.locator('main').getByRole('link', { name: shell.nav.trips, exact: true }).click();
      await page.waitForURL(`${base}/app/trips`);
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === shell.nav.more,
        'More should stay the marked tab on /app/trips',
      );
      await context.close();
    }

    {
      // Account menu: opens, closes on Escape with focus back on the button, closes on a click outside,
      // reaches Settings, and logs out.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app`);
      const trigger = page.getByRole('button', { name: accountLabel });
      check(
        (await trigger.getAttribute('aria-expanded')) === 'false',
        'the account menu starts open',
      );
      await trigger.click();
      check(
        (await trigger.getAttribute('aria-expanded')) === 'true',
        'the account menu did not open',
      );
      check(
        await page.getByRole('link', { name: shell.account.settings }).isVisible(),
        'Settings is not shown in the open account menu',
      );
      await page.keyboard.press('Escape');
      check(
        (await trigger.getAttribute('aria-expanded')) === 'false',
        'Escape did not close the menu',
      );
      check(
        await trigger.evaluate((el) => el === document.activeElement),
        'Escape did not return focus to the account button',
      );
      await trigger.click();
      await page.locator('main').click({ position: { x: 5, y: 5 } });
      check(
        (await trigger.getAttribute('aria-expanded')) === 'false',
        'a click outside did not close the menu',
      );
      await trigger.click();
      await page.getByRole('link', { name: shell.account.settings }).click();
      await page.waitForURL(`${base}/settings`);
      await context.close();
    }

    {
      // Signing out (from the menu) ends up on the log-in page, on both layouts.
      for (const viewport of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
        const { context, page } = await open('en', { signedIn: true, viewport });
        await go(page, `${base}/app`);
        await page.getByRole('button', { name: accountLabel }).click();
        await page.getByRole('button', { name: shell.account.signOut, exact: true }).click();
        await page.waitForURL(`${base}/login`, { timeout: 10_000 }).catch(() => {});
        check(
          new URL(page.url()).pathname === '/login',
          `sign out at ${viewport.width}px did not go to /login (at ${page.url()})`,
        );
        await context.close();
      }
    }

    {
      // Pip is off by default: no entry point anywhere and no page. With the flag on it appears and leads to
      // an honest "not built yet".
      const off = await open('en', { signedIn: true, viewport: VIEWPORTS.phone });
      await go(off.page, `${base}/app`);
      check(
        (await off.page.getByRole('link', { name: shell.pip.ask }).count()) === 0,
        'the Pip entry point shows while the flag is off',
      );
      await go(off.page, `${base}/app/more`);
      check(
        (await off.page.getByRole('link', { name: shell.pip.ask }).count()) === 0,
        'More lists Pip while the flag is off',
      );
      await off.context.close();

      for (const viewport of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
        const on = await open('en', { signedIn: true, viewport });
        await go(on.page, `${pipBase}/app`);
        const entry = on.page.getByRole('link', { name: shell.pip.ask });
        check(
          (await entry.count()) === 1,
          `the Pip entry point is missing at ${viewport.width}px with the flag on`,
        );
        const box = await entry.boundingBox();
        check(
          box !== null && box.width >= 44 && box.height >= 44,
          `the Pip entry point is under 44px at ${viewport.width}px`,
        );
        await entry.click();
        await on.page.waitForURL(`${pipBase}/app/pip`);
        // The URL changes before the page streams in behind the loading state: wait for the text itself.
        await on.page
          .getByText(shell.pip.notBuilt)
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        check(
          await on.page.getByText(shell.pip.notBuilt).isVisible(),
          'the Pip page does not say it is not built',
        );
        await on.context.close();
      }
    }

    {
      // Trips: the list shows the active trip, the filter reaches the archived one, and the create form leads to
      // the trip overview.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app/trips`);
      check(
        (await page.getByText('Japan 2027').count()) >= 1,
        'the trip list does not show the active trip',
      );
      check(
        (await page.getByText('Lisbon weekend').count()) === 0,
        'the default list shows an archived trip',
      );
      await page.goto(`${base}/app/trips?filter=archived`);
      check(
        (await page.getByText('Lisbon weekend').count()) >= 1,
        'the archived filter does not show the archived trip',
      );
      await go(page, `${base}/app/trips`);
      await page.locator('main summary').first().click();
      await page.locator('form#create-trip-form-body input[name=title]').fill('Peru 2028');
      await page.locator('form#create-trip-form-body button[type=submit]').click();
      await page.waitForURL(`${base}/app/trips/${TRIP_ID}`, { timeout: 10_000 }).catch(() => {});
      check(
        page.url() === `${base}/app/trips/${TRIP_ID}`,
        `creating a trip did not lead to its overview (at ${page.url()})`,
      );
      await page.getByRole('heading', { level: 1 }).first().waitFor();
      await context.close();
    }

    {
      // The guard still holds for the new pages: an anonymous visit remembers where it was going.
      const { context, page } = await open('en');
      await go(page, `${base}/app/budget`);
      const url = new URL(page.url());
      check(
        url.pathname === '/login' && url.searchParams.get('next') === '/app/budget',
        `anonymous /app/budget did not go to /login?next=/app/budget (at ${page.url()})`,
      );
      await context.close();
    }
  }
  // Debugging aid: SHOT_DIR=<dir> saves screenshots of the shell in each layout, for a human to look at.
  if (process.env.SHOT_DIR) {
    const views = [
      ['desktop-budget', 'en', VIEWPORTS.desktop, `${base}/app/budget`, null],
      ['laptop-home-pip', 'en', VIEWPORTS.laptop, `${pipBase}/app`, null],
      ['tablet-home', 'en', VIEWPORTS.tablet, `${base}/app`, null],
      ['phone-board-ptbr', 'pt-BR', VIEWPORTS.phone, `${base}/app/board`, null],
      ['narrow-more-ptbr', 'pt-BR', VIEWPORTS.narrow, `${base}/app/more`, null],
      ['phone-menu-pip', 'en', VIEWPORTS.phone, `${pipBase}/app`, 'menu'],
      ['desktop-menu', 'en', VIEWPORTS.desktop, `${base}/app`, 'menu'],
    ];
    for (const [name, locale, viewport, url, extra] of views) {
      for (const theme of ['day', 'red-eye']) {
        const { context, page } = await open(locale, { signedIn: true, viewport });
        await go(page, url);
        await page.evaluate(
          (value) => document.documentElement.setAttribute('data-theme', value),
          theme,
        );
        if (extra === 'menu') {
          await page.getByRole('button', { name: /Account menu|Menu da conta/ }).click();
        }
        await page.screenshot({ path: `${process.env.SHOT_DIR}/${name}-${theme}.png` });
        await context.close();
      }
    }
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
