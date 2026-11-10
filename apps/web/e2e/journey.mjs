/* global document */
// The first real journey, end to end: a real browser against the real web app, the real API, PostgreSQL and
// Mailpit (no stand-ins). Four runs at once, one per width x language:
//
//   desktop (1440x900) and phone (390x844)  x  English and Portuguese
//
// sign up -> confirm through the Mailpit API -> log in -> change currency and language in the settings -> create a
// trip -> reload and see it persisted -> switch language back without losing the trip -> theme on the first paint
// with JavaScript off. Axe checks every page visited, and a keyboard-only pass signs in and creates a trip.
//
// Needs: PostgreSQL migrated and Mailpit up (`pnpm services:up`, `pnpm --filter @globetrot/db migrate`) and the
// built apps (`pnpm turbo run build --filter=@globetrot/web --filter=@globetrot/api`). Then:
//
//   pnpm --filter @globetrot/web test:e2e
//
// The script starts the API and the web app itself (E2E_NO_SPAWN=1 uses ones already running at E2E_WEB). It
// needs no secrets and calls nothing outside this machine. Every account uses a unique email made at run time.
import AxeBuilder from '@axe-core/playwright';
import { spawn } from 'node:child_process';
import { cpSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import en from '../../../packages/i18n/messages/en.json' with { type: 'json' };
import ptBR from '../../../packages/i18n/messages/pt-BR.json' with { type: 'json' };

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const repoRoot = resolve(webRoot, '../..');
const CATALOGS = { en, 'pt-BR': ptBR };
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const API_PORT = Number(process.env.E2E_API_PORT ?? 4000);
const WEB = process.env.E2E_WEB ?? `http://localhost:${WEB_PORT}`;
const MAIL = process.env.E2E_MAIL ?? 'http://localhost:8025';
const PASSWORD = 'correct horse battery staple';
const RUN = Date.now().toString(36);

const children = [];
let log = '';
function start(command, args, options) {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => (log += chunk));
  child.stderr.on('data', (chunk) => (log += chunk));
  children.push(child);
}

async function waitFor(url, what) {
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  throw new Error(`${what} did not start at ${url}\n${log.slice(-1500)}`);
}

if (!process.env.E2E_NO_SPAWN) {
  const standalone = resolve(webRoot, '.next/standalone/apps/web');
  const apiEntry = resolve(repoRoot, 'apps/api/dist/index.js');
  if (!existsSync(resolve(standalone, 'server.js')) || !existsSync(apiEntry)) {
    throw new Error(
      'Build first: pnpm turbo run build --filter=@globetrot/web --filter=@globetrot/api',
    );
  }
  cpSync(resolve(webRoot, '.next/static'), resolve(standalone, '.next/static'), {
    recursive: true,
  });
  if (existsSync(resolve(webRoot, 'public'))) {
    cpSync(resolve(webRoot, 'public'), resolve(standalone, 'public'), { recursive: true });
  }
  const api = `http://localhost:${API_PORT}`;
  start('node', [apiEntry], {
    cwd: repoRoot,
    env: {
      ...process.env,
      API_PORT: String(API_PORT),
      BETTER_AUTH_URL: WEB,
      SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
      SMTP_PORT: process.env.SMTP_PORT ?? '1025',
      EMAIL_FROM: process.env.EMAIL_FROM ?? 'Globetrot <hello@globetrot.local>',
      // Several accounts sign in from one address within a minute: lift the per-address limits for this run.
      AUTH_SIGN_IN_ATTEMPTS_PER_MINUTE: '500',
      AUTH_SIGN_UP_ATTEMPTS_PER_MINUTE: '500',
      AUTH_EMAIL_REQUESTS_PER_MINUTE: '500',
      EMAIL_COOLDOWN_SECONDS: '1',
    },
  });
  start('node', ['server.js'], {
    cwd: standalone,
    env: {
      ...process.env,
      PORT: String(WEB_PORT),
      HOSTNAME: '0.0.0.0',
      API_INTERNAL_URL: api,
      NODE_ENV: 'production',
    },
  });
  await waitFor(`${api}/health`, 'The API');
  await waitFor(`${WEB}/login`, 'The web app');
}

const failures = [];
const note = (message) => failures.push(message);

/** The link in the newest mail sent to `address`, read through Mailpit's HTTP API. */
async function mailLink(address) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const found = await (
      await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`)
    ).json();
    const id = found.messages?.[0]?.ID;
    if (id) {
      const message = await (await fetch(`${MAIL}/api/v1/message/${id}`)).json();
      const link = (message.Text.match(/https?:\/\/[^\s"'<>]+/g) ?? []).find((url) =>
        /verify|token/.test(url),
      );
      if (link) return link;
    }
    await new Promise((wait) => setTimeout(wait, 250));
  }
  throw new Error(`no mail for ${address}`);
}

const other = (locale) => (locale === 'en' ? 'pt-BR' : 'en');

/** One whole journey, in one language at one width. Throws at the first step that cannot continue. */
async function journey(browser, { width, height, locale }) {
  const tag = `${width}px/${locale}`;
  const copy = CATALOGS[locale];
  const email = `e2e-${RUN}-${width}-${locale.toLowerCase()}@example.com`;
  const context = await browser.newContext({ viewport: { width, height }, locale });
  await context.addCookies([{ name: 'globetrot_locale', value: locale, url: WEB }]);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

  /** Opens a page and waits until it has hydrated (a click before that would submit a form natively). */
  async function go(path) {
    await page.goto(`${WEB}${path}`);
    await page.waitForLoadState('networkidle');
  }
  async function axe(label) {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    for (const violation of results.violations) {
      note(
        `${tag} axe on ${label}: ${violation.id} (${violation.nodes.map((node) => node.target.join(' ')).join(' | ')})`,
      );
    }
  }
  const expect = (condition, message) => {
    if (!condition) note(`${tag}: ${message}`);
  };
  const choose = async (label, optionPattern) => {
    await page
      .getByRole('button', { name: new RegExp(label) })
      .first()
      .click();
    await page.getByRole('option', { name: optionPattern }).first().click();
  };

  try {
    // ---- sign up and confirm the email
    await go('/signup');
    await axe('sign-up');
    await page.getByLabel(copy.auth.firstName, { exact: true }).fill('Ana');
    await page.getByLabel(copy.auth.email, { exact: true }).fill(email);
    await page.getByLabel(copy.auth.password, { exact: true }).fill(PASSWORD);
    await page.locator('.gt-checkbox .gt-choice__mark').click();
    await page.getByRole('button', { name: copy.auth.signup.submit, exact: true }).click();
    await page
      .getByRole('heading', { name: copy.auth.signup.sentTitle })
      .waitFor({ timeout: 20_000 });
    await axe('check your inbox');
    await page.goto(await mailLink(email));
    await page.waitForLoadState('networkidle');

    // ---- the account was made in this language
    await go('/settings');
    await axe('settings');
    expect(
      (await page.locator('html').getAttribute('lang')) === locale,
      `the account does not use ${locale} after sign-up`,
    );

    // ---- change currency and language in the settings, and see both stay
    const settings = copy.settings;
    await choose(settings.currency, /^EUR\b/);
    await choose(settings.language, new RegExp(other(locale) === 'en' ? 'English' : 'Português'));
    await page.getByRole('button', { name: settings.save, exact: true }).click();
    await page.waitForURL(/status=saved/, { timeout: 15_000 });
    expect(
      (await page.locator('html').getAttribute('lang')) === other(locale),
      'the saved language did not apply to the page',
    );
    await page.reload();
    await page.waitForLoadState('networkidle');
    const newCopy = CATALOGS[other(locale)].settings;
    expect(
      (
        await page
          .getByRole('button', { name: new RegExp(newCopy.currency) })
          .first()
          .innerText()
      ).includes('EUR'),
      'the saved currency is not there after a reload',
    );
    await axe('settings in the other language');

    // ---- create a trip, reload, see it persisted
    await go('/app/trips');
    await axe('trips (empty)');
    await page.locator('main summary').first().click();
    await page.locator('form#create-trip-form-body input[name=title]').fill('Japan 2027');
    await axe('create trip form');
    await page.locator('form#create-trip-form-body button[type=submit]').click();
    await page.waitForURL(/\/app\/trips\/[0-9a-f-]{36}/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    const tripUrl = page.url();
    await axe('trip overview');
    await page.reload();
    expect(
      (await page.getByText('Japan 2027').count()) >= 1,
      'the trip is not there after a reload',
    );
    await go('/app/trips');
    expect((await page.getByText('Japan 2027').count()) >= 1, 'the trip is not in the list');
    await axe('trips');
    // ---- back to the first language: the trip is still there
    await go('/settings');
    await choose(newCopy.language, new RegExp(locale === 'en' ? 'English' : 'Português'));
    await page.getByRole('button', { name: newCopy.save, exact: true }).click();
    await page.waitForURL(/status=saved/, { timeout: 15_000 });
    await go('/app/trips');
    expect(
      (await page.locator('html').getAttribute('lang')) === locale,
      'the language did not switch back',
    );
    expect(
      (await page.getByText('Japan 2027').count()) >= 1,
      'the trip was lost when the language changed',
    );

    // ---- the board opens
    await go('/app/board');
    await axe('board');
    expect(
      (await page
        .getByRole('heading', { name: CATALOGS[locale].mapBoard.title, level: 1 })
        .count()) === 1,
      'the board has no heading',
    );

    // ---- the route on the board is saved to the trip and is still there after a reload
    const board = CATALOGS[locale].mapBoard;
    await go('/app/board');
    expect((await page.locator('ol li').count()) === 0, 'the board of a new trip is not empty');
    await page.getByRole('button', { name: board.japanRoute, exact: true }).click();
    await page.getByText(board.saved, { exact: true }).waitFor({ timeout: 15_000 });
    const stops = await page.locator('ol li').count();
    expect(stops > 1, 'the sample route did not put stops on the board');
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(
      (await page.locator('ol li').count()) === stops,
      'the saved route is not the same after a reload',
    );
    await page.getByRole('button', { name: board.clearRoute, exact: true }).click();
    await page.getByText(board.saved, { exact: true }).waitFor({ timeout: 15_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(
      (await page.locator('ol li').count()) === 0,
      'clearing the route did not stick after a reload',
    );

    // ---- theme on the first paint: choose red-eye, then load with JavaScript off
    await go('/settings');
    await page
      .getByRole('radiogroup', { name: copy.settings.theme })
      .getByRole('radio', { name: copy.settings.themeRedEye })
      .check({ force: true });
    await page.getByRole('button', { name: copy.settings.save, exact: true }).click();
    await page.waitForURL(/status=saved/, { timeout: 15_000 });
    const cookies = await context.cookies();
    const plain = await browser.newContext({
      viewport: { width, height },
      javaScriptEnabled: false,
    });
    await plain.addCookies(cookies);
    const bare = await plain.newPage();
    await bare.goto(`${WEB}/app/trips`);
    expect(
      (await bare.evaluate(() => document.documentElement.dataset.theme)) === 'red-eye',
      'the saved theme is not in the first HTML (flash)',
    );
    await plain.close();

    // ---- keyboard only: sign out (drop the session), sign in, create another trip
    await context.clearCookies({ name: /session_token/ });
    await go(`/login`);
    await page.getByLabel(copy.auth.email, { exact: true }).focus();
    await page.keyboard.type(email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(PASSWORD);
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/app/, { timeout: 15_000 });
    await go('/app/trips');
    await page.locator('main summary').first().focus();
    await page.keyboard.press('Enter');
    await page.locator('form#create-trip-form-body input[name=title]').focus();
    await page.keyboard.type('Peru 2028');
    await page.keyboard.press('Enter');
    await page.waitForURL(/\/app\/trips\/[0-9a-f-]{36}/, { timeout: 15_000 });
    expect(page.url() !== tripUrl, 'the keyboard-created trip is the same as the first');
    await go('/app/trips');
    expect(
      (await page.getByText('Peru 2028').count()) >= 1,
      'the keyboard-created trip is not in the list',
    );

    for (const problem of problems) note(`${tag}: ${problem}`);
  } catch (error) {
    note(`${tag}: stopped: ${error.message.split('\n')[0]} (at ${page.url()})`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  const runs = [];
  for (const locale of ['en', 'pt-BR']) {
    runs.push({ width: 1440, height: 900, locale }, { width: 390, height: 844, locale });
  }
  await Promise.all(runs.map((run) => journey(browser, run)));
} finally {
  await browser.close();
  for (const child of children) child.kill();
}

if (failures.length > 0) {
  console.error(`${failures.length} problem(s) in the journey:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  if (log) console.error(`\nServer log (tail):\n${log.slice(-1200)}`);
  process.exitCode = 1;
} else {
  console.log(
    'Journey OK: sign up, confirm, log in, settings, trip, persisted, language switch, theme first paint, keyboard (desktop and phone, en and pt-BR), axe clean.',
  );
}
