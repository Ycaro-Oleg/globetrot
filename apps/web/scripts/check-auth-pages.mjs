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
// What the landing's "Save this plan" leaves (lib/plan-draft.ts): Portugal, 12 days, USD 300 a month.
const SAVED_PLAN = encodeURIComponent(
  JSON.stringify({
    cost: '1181',
    saved: '0',
    monthly: '300',
    currency: 'USD',
    suggestion: { destination: 'portugal', likes: ['food'], days: 12, comfort: 'budget' },
  }),
);
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
  theme: 'system',
  motion: 'full',
  homeCity: null,
  pipOptIn: false,
  pipLook: { hat: 'straw', outfit: 'none', bag: 'trolley', bagColor: 'amber' },
  pipName: null,
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
    role: 'owner',
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
    role: 'owner',
  },
];
const TRIP_ID = TRIPS[0].id;
/** Who plans the first trip (ADR-0024): the signed-in owner, an editor and an open link. */
const MEMBERS = {
  members: [
    { userId: 'u-qa', name: 'QA Tester', role: 'owner', you: true },
    { userId: 'u-bruno', name: 'Bruno Costa', role: 'editor', you: false },
  ],
  invites: [{ id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a55', role: 'viewer', expiresAt: NOW }],
  guestLimit: null,
};
const HABIT = {
  week: '2026-W45',
  checkedIn: null,
  streak: 2,
  suggested: { amount: '20000.00', currency: 'JPY' },
  countdown: { daysLeft: 153, phase: 'six-months', tasks: ['passport', 'entryRules', 'flights'] },
};
const INVITE_TOKEN = 'abcdefghijklmnopqrstuv';
const INVITE_PREVIEW = {
  tripTitle: 'Patagonia',
  ownerName: 'Ana Ribeiro',
  role: 'editor',
  joined: false,
  tripId: '01a1c28d-afc9-7767-af40-c937c80dd9ff',
};

const usd = (amount) => ({ amount, currency: 'USD' });
const CATEGORY_KEYS = [
  'flights',
  'stay',
  'local_transport',
  'intercity_transport',
  'food',
  'experiences',
  'insurance',
  'documents',
  'taxes',
  'shopping',
  'buffer',
  'other',
];
const BUDGET = {
  currency: 'USD',
  total: usd('2225.00'),
  byCategory: CATEGORY_KEYS.map((category) => ({
    category,
    amount: usd(category === 'flights' ? '1250.00' : category === 'stay' ? '975.00' : '0.00'),
  })),
  byStatus: ['estimate', 'confirmed', 'paid', 'unknown'].map((status) => ({
    status,
    amount: usd(status === 'estimate' ? '1250.00' : status === 'paid' ? '975.00' : '0.00'),
  })),
  savings: {
    status: 'saving',
    saved: usd('500.00'),
    monthly: usd('300.00'),
    left: usd('1725.00'),
    progressBasisPoints: 2247,
    monthsNeeded: 6,
    readyMonth: '2027-05',
    departure: '2027-07-03',
    departed: false,
    monthsUntilDeparture: 8,
    monthlyNeeded: usd('220.00'),
    onTime: true,
    ceiling: usd('3000.00'),
    ceilingSlack: usd('775.00'),
  },
};
const EXPENSES = [
  {
    id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d01',
    description: 'Flights to Tokyo',
    category: 'flights',
    status: 'estimate',
    original: usd('1250.00'),
    inTripCurrency: usd('1250.00'),
    fx: null,
    createdAt: NOW,
  },
  {
    id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8d02',
    description: 'Ryokan',
    category: 'stay',
    status: 'paid',
    original: { amount: '150000', currency: 'JPY' },
    inTripCurrency: usd('975.00'),
    fx: { rate: '0.0065', source: 'manual', asOf: '2026-11-01' },
    createdAt: NOW,
  },
];

const DAY_PLACES = {
  places: [
    ['Senso-ji', 0, 120, 1],
    ['Fushimi Inari', 1, 180, 2],
    ['Golden Gai', 0, 90, null],
  ].map(([name, stop, minutes, day], index) => ({
    id: `0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8a0${index}`,
    destinationId: `0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8f0${stop}`,
    name,
    minutes,
    day,
  })),
};

const DESTINATIONS = {
  destinations: [
    ['tokyo', 'Tokyo', 35.68, 139.69, 4, 'Ramen in Shinjuku', 'train'],
    ['kyoto', 'Kyoto', 35.01, 135.77, 3, null, 'train'],
    ['osaka', 'Osaka', 34.69, 135.5, 2, null, null],
  ].map(([key, name, latitude, longitude, nights, note, legMode], position) => ({
    id: `0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8f0${position}`,
    position,
    placeKey: `example:${key}`,
    name,
    countryCode: 'JP',
    region: 'Japan',
    latitude,
    longitude,
    nights,
    note,
    legMode,
    visited: position === 0,
    spots:
      position === 0
        ? [{ name: 'Senso-ji', latitude: 35.7148, longitude: 139.7967, done: false }]
        : [],
    todos: position === 0 ? [{ text: 'Buy a Suica card', done: true }] : [],
    photos:
      position === 0
        ? [{ mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9f03', alt: 'Senso-ji gate' }]
        : [],
  })),
};

const LOOK = { hat: 'helmet', outfit: 'vest', bag: 'backpack', bagColor: 'cyan' };
const ANA = { handle: 'ana.ribeiro', name: 'Ana Ribeiro', pipLook: LOOK };
const ME_PERSON = { handle: 'qa.pip', name: USER.name, pipLook: PREFERENCES.pipLook };
const post = (id, extra) => ({
  id: `0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a0${id}`,
  body: '',
  place: null,
  audience: 'everyone',
  attachment: null,
  photos: [],
  createdAt: NOW,
  editedAt: null,
  author: ANA,
  mine: false,
  following: false,
  likes: 0,
  liked: false,
  saved: false,
  comments: 0,
  likedBy: null,
  ...extra,
});
const COMMUNITY_POSTS = [
  post(1, {
    kind: 'tip',
    body: 'Get to Fushimi Inari before 7am.',
    place: { name: 'Fushimi Inari', countryCode: 'JP' },
    likes: 12,
    liked: true,
    saved: true,
    comments: 1,
    likedBy: ME_PERSON,
    photos: [
      { mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9f01', alt: 'Torii gates at dawn' },
      { mediaId: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9f02', alt: '' },
    ],
  }),
  post(2, {
    kind: 'route',
    body: 'Nine nights, tested.',
    attachment: {
      kind: 'route',
      title: 'Portugal',
      nights: 9,
      stops: [
        { name: 'Lisbon', countryCode: 'PT', nights: 4 },
        { name: 'Porto', countryCode: 'PT', nights: 5 },
      ],
      total: { amount: '2300.00', currency: 'USD' },
    },
  }),
  post(3, {
    kind: 'visa',
    author: ME_PERSON,
    mine: true,
    audience: 'followers',
    place: { name: 'Tokyo', countryCode: 'JP' },
    attachment: { kind: 'visa', countryCode: 'JP', city: 'Tokyo', stampedAt: NOW, ordinal: 1 },
  }),
  post(4, {
    kind: 'goal',
    following: true,
    attachment: { kind: 'goal', tripTitle: 'Patagonia', readyMonth: '2027-01', reached: false },
  }),
];
const COMMENTS = {
  comments: [
    {
      id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9b01',
      body: 'Doing this in April!',
      createdAt: NOW,
      author: ME_PERSON,
      mine: true,
      canDelete: true,
      likes: 2,
      liked: false,
    },
  ],
};
const DISCOVER = {
  suggestions: [{ person: ANA, posts: 3 }],
  trending: [
    { countryCode: 'JP', posts: 4 },
    { countryCode: 'PT', posts: 2 },
  ],
};
const PERSON = {
  person: ANA,
  posts: 3,
  followers: 10,
  following: 2,
  followed: false,
  muted: false,
  mine: false,
};

const PROPOSAL = {
  id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9d01',
  tripId: TRIP_ID,
  request: 'Give this trip a calmer pace',
  summary: 'A calmer pace with one more night in Kyoto.',
  currency: 'USD',
  changes: [
    { kind: 'setNights', stopId: 'unknown', nights: 4, reason: 'More time to explore.' },
    {
      kind: 'addStop',
      name: 'Nara',
      countryCode: 'JP',
      latitude: 34.68,
      longitude: 135.8,
      nights: 0,
      afterStopId: null,
      reason: 'An easy day trip.',
    },
    { kind: 'addPlace', stopId: null, name: 'Fushimi Inari', minutes: 120, reason: 'Go early.' },
    {
      kind: 'addChecklistItem',
      group: 'documents',
      label: 'Check entry rules on the official site',
      reason: '',
    },
    {
      kind: 'addExpense',
      category: 'food',
      description: 'Meals',
      amount: '300',
      reason: 'A rough estimate.',
    },
    { kind: 'setMonthly', amount: '250', reason: '' },
  ],
  status: 'proposed',
  applied: [],
  undoable: false,
  createdAt: NOW,
  decidedAt: null,
};

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const VISAS = { visas: [{ countryCode: 'JP', city: 'Tokyo', stampedAt: NOW }] };

const CHECKLIST = {
  items: [
    {
      id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8e01',
      group: 'documents',
      label: 'Passport',
      done: true,
    },
    { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8e02', group: 'documents', label: 'Visa', done: false },
    { id: '0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c8e03', group: 'packing', label: 'Charger', done: false },
  ],
  readiness: {
    dest: true,
    route: true,
    budget: true,
    saved: false,
    docs: false,
    stays: false,
    itin: false,
    check: false,
    ready: false,
  },
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
  const body = ['POST', 'PATCH'].includes(request.method ?? '') ? await readBody(request) : {};
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
  if (route === 'PATCH /v1/me/preferences') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    Object.assign(PREFERENCES, body);
    return reply(response, 200, PREFERENCES);
  }
  const budgetRoute = /^\/v1\/trips\/([^/]+)\/(budget|expenses)$/.exec(url.pathname);
  if (/^\/v1\/trips\/[^/]+\/pip\/proposals$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, { proposals: [PROPOSAL] });
  }
  if (/^\/v1\/media\/[^/]+$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    response.writeHead(200, { 'content-type': 'image/png' });
    return response.end(ONE_PIXEL_PNG);
  }
  if (url.pathname.startsWith('/v1/community/')) {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    const path = url.pathname.slice('/v1/community/'.length);
    if (path === 'feed') return reply(response, 200, { posts: COMMUNITY_POSTS, nextBefore: null });
    if (path === 'me')
      return reply(response, 200, {
        handle: 'qa.pip',
        suggestedHandle: 'qa.pip',
        posts: 1,
        followers: 0,
        following: 1,
      });
    if (path === 'discover') return reply(response, 200, DISCOVER);
    if (/^posts\/[^/]+\/comments$/.test(path)) return reply(response, 200, COMMENTS);
    const one = /^posts\/([^/]+)$/.exec(path);
    if (one) {
      const found = COMMUNITY_POSTS.find((candidate) => candidate.id === one[1]);
      return found ? reply(response, 200, found) : reply(response, 404, { code: 'NOT_FOUND' });
    }
    if (path === 'people/ana.ribeiro') return reply(response, 200, PERSON);
    if (path === 'people/ana.ribeiro/posts')
      return reply(response, 200, { posts: COMMUNITY_POSTS.slice(0, 2), nextBefore: null });
    return reply(response, 404, { code: 'NOT_FOUND' });
  }
  if (url.pathname === '/v1/visas' && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, VISAS);
  }
  if (/^\/v1\/trips\/[^/]+\/members$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, MEMBERS);
  }
  if (/^\/v1\/trips\/[^/]+\/habit$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, HABIT);
  }
  if (/^\/v1\/invites\/[^/]+$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return url.pathname.endsWith(INVITE_TOKEN)
      ? reply(response, 200, INVITE_PREVIEW)
      : reply(response, 404, { code: 'NOT_FOUND' });
  }
  if (/^\/v1\/trips\/[^/]+\/destinations$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, DESTINATIONS);
  }
  if (/^\/v1\/trips\/[^/]+\/day-places$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, DAY_PLACES);
  }
  if (/^\/v1\/trips\/[^/]+\/checklist$/.test(url.pathname) && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, CHECKLIST);
  }
  if (budgetRoute && request.method === 'GET') {
    if (!signedIn) return reply(response, 401, { code: 'UNAUTHENTICATED' });
    return reply(response, 200, budgetRoute[2] === 'budget' ? BUDGET : { expenses: EXPENSES });
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

// The main app has Pip switched off (the default) and the community on, so its screens are checked; a second
// copy has Pip on and the community off (the default), to check both states of each flag.
const main = launch({ FEATURE_COMMUNITY: 'true' });
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
    // `/app` and `/app/days` redirect (to the trip, or to log-in when signed out); after the shell's loading
    // boundary has streamed, Next does that redirect in the browser, so wait for it instead of racing it.
    const from = new URL(url).pathname;
    if (from === '/app' || from === '/app/days') {
      await page.waitForURL((next) => next.pathname !== from);
    }
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
    [
      'login',
      false,
      async (page) => {
        await go(page, `${base}/login`);
        check(
          ((await page.locator('aside').textContent()) ?? '').includes(copy.brand.supporting),
          'log-in no longer speaks to a returning user',
        );
      },
    ],
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
    ['login-provider-failed', false, async (page) => go(page, `${base}/login?error=access_denied`)],
    ['signup', false, async (page) => go(page, `${base}/signup`)],
    [
      'signup-empty-submit',
      false,
      async (page) => {
        await go(page, `${base}/signup`);
        await button(page, copy.signup.submit).click();
        await page.getByText(copy.errors.requiredEmail).first().waitFor();
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
        await button(page, copy.signup.submit).click();
        await page.getByRole('heading', { name: copy.signup.sentTitle }).waitFor();
        check(
          ((await page.locator('aside').textContent()) ?? '').includes(copy.brand.supportingNew),
          '"Check your inbox" speaks to a returning user',
        );
      },
    ],
    [
      // Arriving from the landing's "Save this plan": the trip's cost is shown as an estimate, and the frame speaks
      // to someone new.
      'signup-saved-plan',
      false,
      async (page) => {
        await page
          .context()
          .addCookies([{ name: 'globetrot.plan_draft', value: SAVED_PLAN, url: base }]);
        await go(page, `${base}/signup?next=%2Fapp%2Fstart`);
        const note = page.locator('p').filter({ hasText: '≈' }).first();
        await note.waitFor();
        check(
          /≈\s?\S/.test((await note.textContent()) ?? ''),
          'the saved plan on sign-up does not mark the trip cost as an estimate',
        );
        check(
          ((await page.locator('aside').textContent()) ?? '').includes(copy.brand.supportingNew),
          'sign-up speaks to a returning user',
        );
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
    ['not-found', false, async (page) => go(page, `${base}/this-page-does-not-exist`)],
    ...shellScenarios(copy),
    ['settings', true, async (page) => go(page, `${base}/settings`)],
    ...['phone', 'desktop'].map((layout) => [
      `budget-${layout}`,
      true,
      async (page) => go(page, `${base}/app/budget`),
      VIEWPORTS[layout],
    ]),
    ...['phone', 'desktop'].map((layout) => [
      `budget-drawer-${layout}`,
      true,
      async (page) => {
        await go(page, `${base}/app/budget`);
        await page
          .getByRole('button', {
            name:
              copy === CATALOGS.en.auth
                ? CATALOGS.en.budgetPage.addExpense
                : CATALOGS['pt-BR'].budgetPage.addExpense,
          })
          .click();
        await page.locator('#expense-currency').selectOption('EUR');
        await page.locator('#expense-rate').waitFor();
      },
      VIEWPORTS[layout],
    ]),
    ...['phone', 'desktop'].map((layout) => [
      `lists-${layout}`,
      true,
      async (page) => go(page, `${base}/app/lists`),
      VIEWPORTS[layout],
    ]),
    [
      'trips-example',
      true,
      async (page) => go(page, `${base}/app/trips?example=japan`),
      VIEWPORTS.phone,
    ],
    ...['phone', 'desktop'].map((layout) => [
      `lists-passport-${layout}`,
      true,
      async (page) => go(page, `${base}/app/lists?tab=passport`),
      VIEWPORTS[layout],
    ]),
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
    for (const layout of ['desktop', 'phone']) {
      entries.push([
        `invite-${layout}`,
        true,
        async (page) => go(page, `${base}/app/invite/${INVITE_TOKEN}`),
        VIEWPORTS[layout],
      ]);
    }
    for (const layout of ['desktop', 'phone']) {
      entries.push([
        `today-${layout}`,
        true,
        async (page) => go(page, `${base}/app/today`),
        VIEWPORTS[layout],
      ]);
    }
    for (const [name, path, layout] of [
      ['itinerary-pt-phone', '/roteiros/japao', 'phone'],
      ['itinerary-en-desktop', '/itineraries/portugal?currency=EUR', 'desktop'],
    ]) {
      entries.push([name, false, async (page) => go(page, `${base}${path}`), VIEWPORTS[layout]]);
    }
    entries.push([
      'invite-gone-phone',
      true,
      async (page) => go(page, `${base}/app/invite/zyxwvutsrqponmlkjihgfe`),
      VIEWPORTS.phone,
    ]);
    entries.push([
      'trips-archived-desktop',
      true,
      async (page) => go(page, `${base}/app/trips?filter=archived`),
      VIEWPORTS.desktop,
    ]);
    for (const layout of ['desktop', 'phone']) {
      entries.push([
        `trips-confirm-delete-${layout}`,
        true,
        async (page) =>
          go(
            page,
            `${base}/app/trips?filter=archived&confirmDelete=01a1c28d-afc9-7767-af40-c937c80dd9dd`,
          ),
        VIEWPORTS[layout],
      ]);
    }
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
    entries.push(['shell-days-desktop', true, ...at('/app/days', VIEWPORTS.desktop)]);
    for (const layout of ['narrow', 'tablet', 'laptop']) {
      entries.push([`trip-workspace-${layout}`, true, ...at('/app/trip', VIEWPORTS[layout])]);
    }
    entries.push(['profile-desktop', true, ...at('/app/profile', VIEWPORTS.desktop)]);
    entries.push(['profile-phone', true, ...at('/app/profile', VIEWPORTS.phone)]);
    // My Pip with a changed name: the save button and the "unsaved" mark (the wardrobe is off for now).
    entries.push([
      'profile-pip-name-edited',
      true,
      async (page) => {
        await go(page, `${base}/app/profile`);
        await page.locator('#pip-name').fill('Pipoca');
      },
      VIEWPORTS.desktop,
    ]);
    for (const layout of ['desktop', 'phone']) {
      entries.push([`community-${layout}`, true, ...at('/app/community', VIEWPORTS[layout])]);
    }
    entries.push([
      'community-composer-route',
      true,
      async (page) => {
        await go(page, `${base}/app/community`);
        await page.locator('form textarea').first().focus();
        await page.locator('form fieldset button').nth(2).click();
        await page.locator('form select').first().waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'community-comments-and-menu',
      true,
      async (page) => {
        await go(page, `${base}/app/community`);
        const first = page.locator('article').first();
        await first.locator('button[aria-expanded]').last().click();
        await first.locator('section ul li').first().waitFor();
        await page.locator('article').nth(1).locator('button[aria-controls]').first().click();
        await page.locator('article').nth(1).locator('[id] > button').first().waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'community-person',
      true,
      ...at('/app/community/u/ana.ribeiro', VIEWPORTS.desktop),
    ]);
    entries.push([
      'community-post-phone',
      true,
      ...at('/app/community/p/0193c0a8-7b1e-7c4a-9e2f-3d5a6b7c9a02', VIEWPORTS.phone),
    ]);
    for (const layout of ['desktop', 'phone']) {
      entries.push([`onboarding-welcome-${layout}`, true, ...at('/onboarding', VIEWPORTS[layout])]);
      entries.push([
        `onboarding-home-city-${layout}`,
        true,
        async (page) => {
          await go(page, `${base}/onboarding`);
          await page.locator('form button[type=submit]').click();
          await page.locator('#onboarding-home').waitFor();
        },
        VIEWPORTS[layout],
      ]);
    }
    entries.push([
      'days-add-place',
      true,
      async (page) => {
        await go(page, `${base}/app/trip`);
        await page.locator('main button', { hasText: '+' }).first().click();
        await page.locator('#place-name').waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    // The pin's card on the map, opened from the route list (no tiles needed), then expanded.
    const openPinCard = async (page, origin = base) => {
      await go(page, `${origin}/app/board`);
      await page.locator('ol li').first().locator('button').first().click();
      await page
        .locator('[role=group] button', { hasText: /Spots|Pontos/ })
        .first()
        .click();
      await page.locator('[data-pin-card]').waitFor();
    };
    entries.push(['board-pin-card-desktop', true, openPinCard, VIEWPORTS.desktop]);
    // With Pip on, the Spots tab also offers "Pip, suggest places in …".
    entries.push([
      'board-pin-card-pip-desktop',
      true,
      async (page) => {
        await openPinCard(page, pipBase);
        await page
          .getByRole('button', { name: /^(Pip, suggest places in|Pip, sugira lugares em)/ })
          .waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    entries.push([
      'board-pin-card-expanded-desktop',
      true,
      async (page) => {
        await openPinCard(page);
        await page.getByRole('button', { name: /^(Expand the card|Expandir o cartão)$/ }).click();
        await page.locator('[data-pin-card][data-expanded]').waitFor();
      },
      VIEWPORTS.desktop,
    ]);
    for (const section of ['trip', 'board', 'budget', 'lists', 'trips', 'passport']) {
      entries.push([`shell-${section}-phone`, true, ...at(`/app/${section}`, VIEWPORTS.phone)]);
    }
    entries.push(['shell-budget-desktop', true, ...at('/app/budget', VIEWPORTS.desktop)]);
    entries.push(['shell-passport-desktop', true, ...at('/app/passport', VIEWPORTS.desktop)]);
    entries.push(['shell-settings-desktop', true, ...at('/settings', VIEWPORTS.desktop)]);
    entries.push(['shell-settings-phone', true, ...at('/settings', VIEWPORTS.phone)]);
    for (const layout of ['desktop', 'phone']) {
      entries.push([
        `settings-delete-account-${layout}`,
        true,
        async (page) => {
          await go(page, `${base}/settings`);
          await page.getByRole('button', { name: /Delete account…|Excluir conta…/ }).click();
          await page.locator('form input[type=email]').waitFor();
        },
        VIEWPORTS[layout],
      ]);
    }
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
    entries.push([
      'shell-community-off-404',
      true,
      async (page) => {
        // The community is hidden by default (FEATURE_COMMUNITY): the copy with Pip on has it off.
        const response = await page.goto(`${pipBase}/app/community`);
        await page.waitForLoadState('networkidle');
        if (response?.status() !== 404) {
          throw new Error(`/app/community answered ${response?.status()} with the flag off`);
        }
      },
      VIEWPORTS.phone,
    ]);
    entries.push(['shell-discover-desktop', true, ...at('/app/discover', VIEWPORTS.desktop)]);
    entries.push(['shell-discover-phone', true, ...at('/app/discover', VIEWPORTS.phone)]);
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

  /** Runs `task` over `items`, at most `limit` at a time. */
  async function inParallel(items, limit, task) {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) await task(items[next++]);
      }),
    );
  }

  // Each state is reached once and checked in both themes (the theme is one attribute on <html>). Languages run
  // one after the other because the stand-in API answers with one stored language at a time; the states of one
  // language run side by side (AXE_CONCURRENCY, default 6).
  const concurrency = Number(process.env.AXE_CONCURRENCY ?? 6);
  for (const locale of ['en', 'pt-BR']) {
    const copy = CATALOGS[locale].auth;
    const chosen = scenarios(copy).filter(
      // Debugging aid: AXE_ONLY=<regex> runs only the matching scenarios (and skips the behavior checks).
      ([name]) => !process.env.AXE_ONLY || new RegExp(process.env.AXE_ONLY).test(name),
    );
    await inParallel(chosen, concurrency, async ([name, signedIn, reach, viewport]) => {
      // A page that redirects while the machine is busy can swap its document under a running check ("Execution
      // context was destroyed"). That is the harness racing the page, not a finding: try the state once more.
      for (let attempt = 0; attempt < 2; attempt++) {
        const { context, page } = await open(locale, { signedIn, viewport });
        const found = [];
        try {
          await reach(page);
          await page.waitForLoadState('networkidle');
          // Debugging aid: DUMP_SCENARIO=<name> prints the page's HTML for that state.
          if (process.env.DUMP_SCENARIO === name && locale === 'en') {
            console.log(await page.evaluate(() => document.body.innerHTML));
          }
          for (const theme of ['day', 'red-eye']) {
            await page.evaluate(
              (value) => document.documentElement.setAttribute('data-theme', value),
              theme,
            );
            const results = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
              .analyze();
            for (const violation of results.violations) {
              const where = violation.nodes
                .map(
                  (node) =>
                    `${node.target.join(' ')} ${node.html.slice(0, 140)} [${(node.any[0]?.message ?? '').slice(0, 170)}]`,
                )
                .join(' | ');
              found.push(`axe ${theme}/${locale}/${name}: ${violation.id} (${where})`);
            }
          }
          if ((await page.locator('html').getAttribute('lang')) !== locale) {
            found.push(`${locale}/${name}: <html lang> is not ${locale}`);
          }
          failures.push(...found);
          break;
        } catch (error) {
          const message = error.message.split('\n')[0];
          if (attempt === 0 && /context was destroyed|navigation/i.test(message)) continue;
          failures.push(`${locale}/${name}: could not reach the state (${message})`);
          break;
        } finally {
          await context.close();
        }
      }
    });
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
    await page.waitForURL(`${base}/app/trip`, { timeout: 10_000 }).catch(() => {});
    check(
      page.url() === `${base}/app/trip`,
      `keyboard-only login did not land on the trip (at ${page.url()})`,
    );
    // The board's route panel is headed by the current trip.
    const boardHeading = page.getByRole('heading', { name: TRIPS[0].title, level: 1 });
    await boardHeading.waitFor({ timeout: 10_000 }).catch(() => {});
    check(await boardHeading.isVisible(), 'the board page has no heading');
    await context.close();
  }

  {
    // A failed Google sign-in comes back as /login?error=<code>: one message, announced as an alert, no code shown.
    const { context, page } = await open('en');
    await go(page, `${base}/login?error=access_denied`);
    await page.getByRole('alert').filter({ hasText: copy.errors.socialFailed }).waitFor();
    check(
      !(await page.locator('body').innerText()).includes('access_denied'),
      'login: the provider error code is shown to the visitor',
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
  // The app shell (design handoff v2, the TopBar): layout per screen size, navigation, keyboard, account menu,
  // Pip flag.
  // -------------------------------------------------------------------------------------------------------
  {
    const shell = CATALOGS.en.shell;
    const accountLabel = shell.account.menu.replace('{name}', USER.name);
    const tools = (nav) => [nav.overview, nav.board, nav.budget, nav.lists];
    const tripNav = (page, locale = 'en') =>
      page.getByRole('navigation', { name: CATALOGS[locale].shell.nav.tripLabel });
    // Inside the trip workspace the trip's own sections replace the bar's trip tools.
    const sidebarNav = (page, locale = 'en') =>
      page.getByRole('navigation', { name: CATALOGS[locale].workspace.sidebarLabel });
    const jumpNav = (page, locale = 'en') =>
      page.getByRole('navigation', { name: CATALOGS[locale].workspace.jumpLabel });
    const placesNav = (page, locale = 'en') =>
      page.getByRole('navigation', { name: CATALOGS[locale].shell.nav.globalLabel });
    const names = async (nav) => (await nav.getByRole('link').allInnerTexts()).map((n) => n.trim());

    {
      // Desktop: one bar of 60px with the trip tools inline and the account places on the right; no bottom bar.
      // (Off the trip workspace: inside it the sidebar takes the trip tools' place.)
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app/discover`);
      const trip = tripNav(page);
      check((await trip.count()) === 1, 'desktop: expected exactly one visible trip navigation');
      check(
        JSON.stringify(await names(trip)) === JSON.stringify(tools(shell.nav)),
        `desktop: the trip tools are ${JSON.stringify(await names(trip))}`,
      );
      const places = placesNav(page);
      check(
        (await places.count()) === 1,
        'desktop: expected exactly one visible account navigation',
      );
      check(
        JSON.stringify(await names(places)) === JSON.stringify([shell.nav.discover]),
        `desktop: the account places are ${JSON.stringify(await names(places))}`,
      );
      const bar = await page.locator('header').first().boundingBox();
      check(
        bar !== null && Math.round(bar.height) === 60 && bar.y === 0,
        'desktop: the bar is not 60px at the top',
      );
      check(
        (await page.locator('[data-shell-tabbar]').count()) === 1,
        'desktop: the bottom bar is missing from the page',
      );
      check(
        !(await page.locator('[data-shell-tabbar]').isVisible()),
        'desktop: the bottom bar is drawn on a wide screen',
      );
      await context.close();
    }

    for (const locale of ['en', 'pt-BR']) {
      // Phone, down to 320px wide: the trip tools as a second row on the map, the workspace's jump bar on its
      // pages, the account places in a bottom bar (not on the map), every link at least 44px, nothing wider than
      // the screen.
      const nav = CATALOGS[locale].shell.nav;
      for (const viewport of [VIEWPORTS.narrow, VIEWPORTS.phone]) {
        for (const path of ['/app/budget', '/app/passport', '/app/board']) {
          const { context, page } = await open(locale, { signedIn: true, viewport });
          await go(page, `${base}${path}`);
          const where = `phone ${viewport.width}px ${locale} ${path}`;
          const onTrip = path === '/app/board';
          const inWorkspace = path === '/app/budget';
          const trip = tripNav(page, locale);
          check(
            (await trip.count()) === (onTrip ? 1 : 0),
            `${where}: the trip row is ${onTrip ? 'missing' : 'shown off the map'}`,
          );
          if (onTrip) {
            check(
              JSON.stringify(await names(trip)) === JSON.stringify(tools(nav)),
              `${where}: the trip row is ${JSON.stringify(await names(trip))}`,
            );
          }
          const jump = jumpNav(page, locale);
          check(
            (await jump.count()) === (inWorkspace ? 1 : 0),
            `${where}: the workspace's jump bar is ${inWorkspace ? 'missing' : 'shown off the workspace'}`,
          );
          if (inWorkspace) {
            check(
              !(await sidebarNav(page, locale).isVisible()),
              `${where}: the workspace's sidebar is drawn on a phone`,
            );
          }
          const bottom = placesNav(page, locale);
          const onMap = path === '/app/board';
          check(
            (await bottom.count()) === (onMap ? 0 : 1),
            `${where}: the bottom bar is ${onMap ? 'shown on the map' : 'missing'}`,
          );
          if (!onMap) {
            check(
              JSON.stringify(await names(bottom)) ===
                JSON.stringify([nav.trip, nav.discover, nav.profile]),
              `${where}: the bottom bar is ${JSON.stringify(await names(bottom))}`,
            );
          }
          for (const group of [trip, bottom]) {
            if (!(await group.count())) continue;
            for (const link of await group.getByRole('link').all()) {
              const box = await link.boundingBox();
              check(
                box !== null && box.height >= 44 && box.width >= 44,
                `${where}: a link is smaller than 44px`,
              );
              check(
                box !== null && box.x >= 0 && box.x + box.width <= viewport.width,
                `${where}: a link sticks out of the screen`,
              );
            }
          }
          if (inWorkspace) {
            // The jump bar scrolls sideways inside itself on the narrowest phones; its links stay touch targets.
            for (const link of await jump.getByRole('link').all()) {
              const box = await link.boundingBox();
              check(
                box !== null && box.height >= 44,
                `${where}: a jump bar link is shorter than 44px`,
              );
            }
          }
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          check(overflow <= 0, `${where}: the page scrolls sideways by ${overflow}px`);
          if (!onMap) {
            // Scrolled to the end, the last line of content must not hide under the bottom bar.
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            const bar = await bottom.boundingBox();
            const contentBottom = await page.locator('main').evaluate((el) => {
              const last = el.lastElementChild;
              return last ? last.getBoundingClientRect().bottom : 0;
            });
            check(
              bar !== null && contentBottom <= bar.y + 1,
              `${where}: the content runs under the bottom bar`,
            );
          }
          await context.close();
        }
      }
    }

    {
      // The layout breaks exactly at 720: below it the trip row and the bottom bar, from it the inline tabs.
      const { context, page } = await open('en', {
        signedIn: true,
        viewport: { width: 719, height: 800 },
      });
      await go(page, `${base}/app/discover`);
      const bottom = await placesNav(page).boundingBox();
      check(bottom !== null && bottom.y > 600, '719px: the bottom bar is not at the bottom');
      await go(page, `${base}/app/board`);
      const row = await tripNav(page).boundingBox();
      check(
        row !== null && row.y >= 59 && row.width >= 700,
        '719px: the trip tools are not a full-width row',
      );
      await page.setViewportSize({ width: 720, height: 800 });
      const inline = await tripNav(page).boundingBox();
      check(
        inline !== null && inline.y < 20 && inline.width < 500,
        '720px: the trip tools are not inline in the bar',
      );
      const places = await placesNav(page).boundingBox();
      check(places !== null && places.y < 20, '720px: the account places are not in the bar');
      await context.close();
    }

    {
      // The trip workspace: the jump bar below 720, the sidebar from 720, the map beside the page from 1100
      // (below it, a button that opens the full map).
      const { context, page } = await open('en', {
        signedIn: true,
        viewport: { width: 719, height: 800 },
      });
      await go(page, `${base}/app/trip`);
      const mapRegion = page.getByRole('region', { name: CATALOGS.en.workspace.mapRegion });
      const mapButton = page.getByRole('link', {
        name: CATALOGS.en.workspace.openMap,
        exact: true,
      });
      check(await jumpNav(page).isVisible(), '719px: the workspace has no jump bar');
      check(!(await sidebarNav(page).isVisible()), '719px: the workspace sidebar is drawn');
      check(await mapButton.isVisible(), '719px: there is no button to open the map');
      await page.setViewportSize({ width: 720, height: 800 });
      check(await sidebarNav(page).isVisible(), '720px: the workspace sidebar is missing');
      check(!(await jumpNav(page).isVisible()), '720px: the jump bar is still drawn');
      await page.setViewportSize({ width: 1099, height: 800 });
      check((await mapRegion.count()) === 0, '1099px: the map is drawn beside the page');
      check(await mapButton.isVisible(), '1099px: there is no button to open the map');
      await page.setViewportSize({ width: 1100, height: 800 });
      await mapRegion.waitFor();
      check(!(await mapButton.isVisible()), '1100px: the map button stays beside the map');
      // The sidebar is a drawer: it folds to a rail and opens again, and its edge resizes with the keyboard.
      const ws = CATALOGS.en.workspace;
      const edge = page.getByRole('separator', { name: ws.sidebarResize });
      const before = Number(await edge.getAttribute('aria-valuenow'));
      await edge.focus();
      await page.keyboard.press('ArrowRight');
      const after = Number(await edge.getAttribute('aria-valuenow'));
      check(
        after === before + 16,
        `the sidebar edge moved from ${before} to ${after} with ArrowRight`,
      );
      await page.keyboard.press('End');
      check(
        (await edge.getAttribute('aria-valuenow')) === '360',
        'End does not take the sidebar to its widest',
      );
      const nav = sidebarNav(page);
      const navBox = await nav.boundingBox();
      check(navBox !== null && navBox.width > 300, 'the wider sidebar did not grow on screen');
      await page.getByRole('button', { name: ws.sidebarHide }).click();
      check(!(await nav.isVisible()), 'the folded drawer still shows the sections');
      const show = page.getByRole('button', { name: ws.sidebarShow });
      check(
        (await show.getAttribute('aria-expanded')) === 'false',
        'the folded toggle is not collapsed',
      );
      await page.reload();
      await page.waitForLoadState('networkidle');
      check(
        !(await sidebarNav(page).isVisible()),
        'the folded drawer did not stay folded on reload',
      );
      await page.getByRole('button', { name: ws.sidebarShow }).click();
      check(await sidebarNav(page).isVisible(), 'the drawer did not open again');
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
      // Walk the bar with Tab and make sure every stop draws a focus ring of at least the token width.
      await page.keyboard.press('Shift+Tab');
      for (let stop = 0; stop < 10; stop++) {
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
      // Navigation: /app opens the trip's workspace with Overview marked; the sidebar leads to the budget and
      // moves the mark; Discover marks the account place.
      const workspace = CATALOGS.en.workspace;
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app`);
      check(new URL(page.url()).pathname === '/app/trip', `/app went to ${page.url()}`);
      const nav = sidebarNav(page);
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === workspace.overview,
        'Overview is not the marked section after /app redirects to the trip',
      );
      await nav.getByRole('link', { name: workspace.budget, exact: true }).click();
      await page.waitForURL(`${base}/app/budget`);
      await page.getByRole('heading', { name: CATALOGS.en.budgetPage.title, level: 1 }).waitFor();
      check(
        (await nav.locator('[aria-current="page"]').allInnerTexts()).join() === workspace.budget,
        'Budget is not the marked section on /app/budget',
      );
      check(
        await page.getByText(CATALOGS.en.budgetPage.answerKicker).isVisible(),
        'the Budget page does not show the savings answer',
      );
      check(
        (await page.title()).startsWith(CATALOGS.en.budgetPage.title),
        `the Budget page title is "${await page.title()}"`,
      );
      await placesNav(page).getByRole('link', { name: shell.nav.discover, exact: true }).click();
      await page.waitForURL(`${base}/app/discover`);
      check(
        (await placesNav(page).locator('[aria-current="page"]').allInnerTexts()).join() ===
          shell.nav.discover,
        'Discover is not the marked place on /app/discover',
      );
      await context.close();
    }

    {
      // Account menu: opens, closes on Escape with focus back on the button, closes on a click outside,
      // reaches Settings (inside the same shell), and logs out.
      const { context, page } = await open('en', { signedIn: true, viewport: VIEWPORTS.desktop });
      await go(page, `${base}/app/budget`);
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
      check(
        (await page.getByRole('button', { name: accountLabel }).count()) === 1,
        'Settings is not inside the shell',
      );
      await context.close();
    }

    {
      // Signing out (from the menu) ends up on the log-in page, on both layouts.
      for (const viewport of [VIEWPORTS.desktop, VIEWPORTS.phone]) {
        const { context, page } = await open('en', { signedIn: true, viewport });
        await go(page, `${base}/app/budget`);
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
      // the Pip page.
      for (const viewport of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
        const off = await open('en', { signedIn: true, viewport });
        await go(off.page, `${base}/app/budget`);
        check(
          (await off.page.getByRole('link', { name: shell.pip.ask, exact: true }).count()) === 0,
          `the Pip entry point shows at ${viewport.width}px while the flag is off`,
        );
        await off.context.close();

        const on = await open('en', { signedIn: true, viewport });
        await go(on.page, `${pipBase}/app/budget`);
        const entry = on.page.getByRole('link', { name: shell.pip.ask, exact: true });
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
        // The floating button opens Pip on the screen's topic (here the budget).
        await on.page.waitForURL((next) => next.pathname === '/app/pip');
        // The URL changes before the page streams in behind the loading state: wait for the text itself.
        const pipCopy = CATALOGS.en.pipPage;
        await on.page
          .getByText(pipCopy.askLabel)
          .waitFor({ timeout: 10_000 })
          .catch(() => {});
        check(
          await on.page.getByText(pipCopy.askLabel).isVisible(),
          'the Pip page does not offer to ask Pip',
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
      // Theme and motion: the first paint is already right, for explicit and system choices, anonymous and signed in.
      const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
      const withCookies = async (cookies, options = {}) => {
        PREFERENCES.theme = 'system';
        PREFERENCES.motion = 'full';
        const browserContext = await browser.newContext({
          viewport: VIEWPORTS.desktop,
          ...options,
        });
        await browserContext.addCookies(
          cookies.map(([name, value]) => ({ name, value, url: base })),
        );
        return { context: browserContext, page: await browserContext.newPage() };
      };

      // An explicit choice is in the server's HTML: no script needed, so no flash.
      const noScript = await withCookies([['globetrot_theme', 'red-eye']], {
        javaScriptEnabled: false,
      });
      await noScript.page.goto(`${base}/login`);
      check(
        (await themeOf(noScript.page)) === 'red-eye',
        'a saved red-eye theme is not in the server-rendered page',
      );
      await noScript.context.close();

      // `system` follows the OS before the first paint (the head script runs before the body is parsed).
      for (const [scheme, expected] of [
        ['dark', 'red-eye'],
        ['light', 'day'],
      ]) {
        const { context, page } = await withCookies([], { colorScheme: scheme });
        await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
        check(
          (await themeOf(page)) === expected,
          `system theme with a ${scheme} OS is ${await themeOf(page)} at DOMContentLoaded, not ${expected}`,
        );
        if (scheme === 'dark') {
          await page.emulateMedia({ colorScheme: 'light' });
          // The browser reports the change to the page asynchronously: wait for the result, never a fixed delay.
          await page
            .waitForFunction(() => document.documentElement.dataset.theme === 'day', null, {
              timeout: 5000,
            })
            .catch(() => {});
          check(
            (await themeOf(page)) === 'day',
            'the system theme did not follow the OS changing to light',
          );
        }
        await context.close();
      }

      // An explicit choice beats the OS.
      {
        const { context, page } = await withCookies([['globetrot_theme', 'day']], {
          colorScheme: 'dark',
        });
        await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
        check((await themeOf(page)) === 'day', 'a saved day theme lost to a dark OS');
        await context.close();
      }

      // Reduced motion: the person's setting and the OS setting both stop transitions; the OS wins over "full".
      const transitionOf = (page) =>
        page.evaluate(() => {
          const el = document.querySelector('.gt-button');
          return el ? getComputedStyle(el).transitionDuration : null;
        });
      const isStill = (value) =>
        value !== null && value.split(',').every((part) => parseFloat(part) < 0.001);
      {
        const full = await withCookies([['globetrot_motion', 'full']]);
        await go(full.page, `${base}/login`);
        check(
          !isStill(await transitionOf(full.page)),
          'full motion has no transition on the buttons',
        );
        await full.context.close();

        const reduced = await withCookies([['globetrot_motion', 'reduced']]);
        await go(reduced.page, `${base}/login`);
        check(
          (await reduced.page.locator('html').getAttribute('data-motion')) === 'reduced',
          'the reduced motion choice is not on <html>',
        );
        check(isStill(await transitionOf(reduced.page)), 'reduced motion still has transitions');
        await reduced.context.close();

        const os = await withCookies([['globetrot_motion', 'full']], { reducedMotion: 'reduce' });
        await go(os.page, `${base}/login`);
        check(
          isStill(await transitionOf(os.page)),
          'the OS reduced-motion setting did not win over full motion',
        );
        await os.context.close();
      }

      // The settings form: keyboard operable, saved with the account, and still there after a reload.
      {
        const { context, page } = await withCookies([['globetrot.session_token', 'ok']]);
        await go(page, `${base}/settings`);
        const group = page.getByRole('radiogroup', { name: CATALOGS.en.settings.theme });
        check(
          (await group.getByRole('radio').count()) === 3,
          'the theme control does not have three options',
        );
        await group
          .getByRole('radio', { name: CATALOGS.en.settings.themeSystem })
          .check({ force: true });
        // Keyboard: focus the selected radio and move with the arrow keys.
        await group.getByRole('radio', { name: CATALOGS.en.settings.themeSystem }).focus();
        await page.keyboard.press('ArrowLeft');
        check(
          await group.getByRole('radio', { name: CATALOGS.en.settings.themeRedEye }).isChecked(),
          'the arrow keys do not move the theme choice',
        );
        await page
          .getByRole('radiogroup', { name: CATALOGS.en.settings.motion })
          .getByRole('radio', { name: CATALOGS.en.settings.motionReduced })
          .check({ force: true });
        await page.getByRole('button', { name: CATALOGS.en.settings.save, exact: true }).click();
        await page.waitForURL(/status=saved/, { timeout: 10_000 }).catch(() => {});
        check(
          page.url().includes('status=saved'),
          `saving the settings did not succeed (at ${page.url()})`,
        );
        check(
          (await themeOf(page)) === 'red-eye',
          'the saved theme did not apply to the page after saving',
        );
        check(
          (await page.locator('html').getAttribute('data-motion')) === 'reduced',
          'the saved motion did not apply to the page after saving',
        );
        check(
          PREFERENCES.theme === 'red-eye' && PREFERENCES.motion === 'reduced',
          'the choice was not saved with the account',
        );
        await context.close();

        // Another device, signed in: the stored choice applies with no cookie at all.
        const fresh = await withCookies([['globetrot.session_token', 'ok']]);
        PREFERENCES.theme = 'red-eye';
        PREFERENCES.motion = 'reduced';
        await fresh.page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
        check(
          (await themeOf(fresh.page)) === 'red-eye',
          'the stored theme did not apply on a device with no cookie',
        );
        await fresh.context.close();
      }

      PREFERENCES.theme = 'system';
      PREFERENCES.motion = 'full';
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
      ['desktop-lists', 'en', VIEWPORTS.desktop, `${base}/app/lists`, null],
      ['phone-trips-example', 'en', VIEWPORTS.phone, `${base}/app/trips?example=japan`, null],
      ['desktop-landing-pricing', 'en', VIEWPORTS.desktop, `${base}/#pricing`, null],
      ['desktop-board', 'en', VIEWPORTS.desktop, `${base}/app/board`, 'stop'],
      ['phone-board-sheet-ptbr', 'pt-BR', VIEWPORTS.phone, `${base}/app/board`, 'stop'],
      ['phone-landing-trips-ptbr', 'pt-BR', VIEWPORTS.phone, `${base}/#trips`, null],
      ['phone-lists-ptbr', 'pt-BR', VIEWPORTS.phone, `${base}/app/lists`, null],
      ['laptop-home-pip', 'en', VIEWPORTS.laptop, `${pipBase}/app`, null],
      ['tablet-home', 'en', VIEWPORTS.tablet, `${base}/app`, null],
      ['phone-board-ptbr', 'pt-BR', VIEWPORTS.phone, `${base}/app/board`, null],
      ['narrow-passport-ptbr', 'pt-BR', VIEWPORTS.narrow, `${base}/app/passport`, null],
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
        if (extra === 'stop') {
          await page.locator('ol li').first().locator('button').first().click();
        }
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
