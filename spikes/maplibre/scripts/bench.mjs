// Reproducible measurements for spike #2 (run inside mcr.microsoft.com/playwright, against `vite preview`).
//   node scripts/bench.mjs http://localhost:4173 out-dir
// Profiles: desktop (no throttling) and "mid-range phone" (4x CPU slowdown, 4G network, 390x844 @2x).
// Rendering is software WebGL (SwiftShader) in headless Chromium, so FPS numbers are pessimistic vs. a real GPU.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'bench-out';
mkdirSync(out, { recursive: true });

const NET_4G = { offline: false, latency: 150, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (3 * 1024 * 1024) / 8 };
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, dpr: 1, cpu: 1, net: null, mobile: false },
  { name: 'phone-4x-4g', viewport: { width: 390, height: 844 }, dpr: 2, cpu: 4, net: NET_4G, mobile: true },
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [];

for (const p of profiles) {
  const ctx = await browser.newContext({ viewport: p.viewport, deviceScaleFactor: p.dpr, isMobile: p.mobile, hasTouch: p.mobile });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (p.net) await cdp.send('Network.emulateNetworkConditions', p.net);
  if (p.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu });

  // Cold load straight into the region view: time to first map idle, and bytes transferred.
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  const t0 = Date.now();
  await page.goto(`${base}/?region`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__spike && window.map && window.map.loaded() && window.__spike.metrics.firstIdleMs > 0, null, { timeout: 120000 });
  await page.waitForFunction(() => window.map.areTilesLoaded(), null, { timeout: 120000 });
  const loadMs = Date.now() - t0;
  await page.waitForTimeout(1200);
  const coldBytes = bytes;
  const firstIdleMs = await page.evaluate(() => window.__spike.metrics.firstIdleMs);
  await page.screenshot({ path: `${out}/${p.name}-region-day.jpg`, type: 'jpeg', quality: 72 });

  const run = async (mode) => {
    await page.evaluate((m) => window.__spike.setMode(m), mode);
    await page.evaluate(() => new Promise((r) => (window.map.areTilesLoaded() ? r() : window.map.once('idle', r))));
    await page.waitForTimeout(500);
    return page.evaluate(() => window.__spike.bench(5));
  };
  const benches = {};
  for (const mode of ['stops', 'pins50', 'poi-symbol', 'poi-dom']) benches[mode] = await run(mode);
  await page.evaluate(() => window.__spike.setMode('pins50'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${p.name}-pins50.jpg`, type: 'jpeg', quality: 72 });

  // Night theme + world view screenshots.
  await page.evaluate(() => { window.__spike.setMode('stops'); window.__spike.setTheme('night'); });
  await page.waitForTimeout(400);
  await page.evaluate(() => new Promise((r) => window.map.once('idle', r)));
  await page.screenshot({ path: `${out}/${p.name}-region-night.jpg`, type: 'jpeg', quality: 72 });
  await page.evaluate(() => window.__spike.goWorld());
  await page.waitForTimeout(1500);
  await page.evaluate(() => new Promise((r) => (window.map.areTilesLoaded() ? r() : window.map.once('idle', r))));
  await page.screenshot({ path: `${out}/${p.name}-world-night.jpg`, type: 'jpeg', quality: 72 });

  // Pin hit areas: every pin button must be at least 44x44 CSS px.
  const hitAreas = await page.evaluate(() => [...document.querySelectorAll('.pin')].map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));

  results.push({ profile: p.name, loadMs, firstIdleMs, coldKB: Math.round(coldBytes / 1024), minPinHitPx: Math.min(...hitAreas), benches });
  await ctx.close();
}

// Mobile crosshair flow: pan, "Pin here", check the pin landed at the crosshair (no throttling, for a functional check).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${base}/?region`);
  await page.waitForFunction(() => window.map && window.map.loaded());
  await page.evaluate(() => new Promise((r) => window.map.once('idle', r)));
  await page.click('#mobilebar [data-act="pin-tool"]');
  await page.evaluate(() => window.map.panBy([0, 120], { animate: false }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/phone-crosshair.jpg`, type: 'jpeg', quality: 72 });
  // Read the crosshair centre *before* pinning (the tool hides it afterwards).
  const target = await page.evaluate(() => {
    const ch = document.getElementById('crosshair').getBoundingClientRect();
    return { x: ch.left + ch.width / 2, y: ch.top + ch.height / 2 };
  });
  await page.click('#mobilebar [data-act="pin-here"]');
  await page.waitForTimeout(300);
  const toast = await page.textContent('#toast');
  const landed = await page.evaluate((t) => {
    const sel = document.querySelector('.pin.sel').getBoundingClientRect();
    return { crosshair: t, dx: Math.round(sel.left + sel.width / 2 - t.x), dy: Math.round(sel.top + sel.height / 2 - t.y), crosshairHiddenAfter: document.getElementById('crosshair').hidden };
  }, target);
  await page.screenshot({ path: `${out}/phone-pinned.jpg`, type: 'jpeg', quality: 72 });
  results.push({ profile: 'phone-crosshair', toast, landed });
  await ctx.close();
}

await browser.close();
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
