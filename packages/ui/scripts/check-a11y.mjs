/* global document */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../storybook-static');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) throw new Error('Outside storybook directory');
    const data = await readFile(file);
    response.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('No HTTP port');
const base = 'http://127.0.0.1:' + address.port;
const index = await (await fetch(base + '/index.json')).json();
const stories = Object.values(index.entries).filter((entry) => entry.type === 'story');
if (!stories.length) {
  server.close();
  throw new Error('No Storybook stories found; build Storybook first');
}
const browser = await chromium.launch({ headless: true }).catch((error) => {
  server.close();
  throw error;
});
const context = await browser.newContext({ viewport: { width: 375, height: 800 } });
const page = await context.newPage();
const failures = [];
try {
  for (const theme of ['day', 'red-eye']) {
    for (const locale of ['en', 'pt-BR']) {
      for (const story of stories) {
        const params = new URLSearchParams({
          id: story.id,
          globals: 'theme:' + theme + ';locale:' + locale,
        });
        await page.goto(base + '/iframe.html?' + params);
        await page.locator('#storybook-root > *').first().waitFor();
        await page.waitForFunction(
          (expected) => document.documentElement.getAttribute('data-theme') === expected,
          theme,
        );
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        for (const violation of results.violations)
          failures.push(theme + '/' + locale + '/' + story.id + ': ' + violation.id);
      }
      const tokenParams = new URLSearchParams({
        id: 'foundations-tailwind-tokens--theme-utilities',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + tokenParams);
      const tokenCard = page.getByTestId('token-utility');
      const background = await tokenCard.evaluate(
        (element) => globalThis.getComputedStyle(element).backgroundColor,
      );
      const expectedBackground = theme === 'day' ? 'rgb(255, 255, 255)' : 'rgb(42, 38, 80)';
      if (background !== expectedBackground)
        failures.push(theme + '/' + locale + ': Tailwind token utility did not resolve');
      const params = new URLSearchParams({
        id: 'primitives-selectfield--default',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + params);
      const trigger = page.getByRole('button', {
        name: locale === 'pt-BR' ? /moeda/i : /currency/i,
      });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page
        .getByRole('option', { name: locale === 'pt-BR' ? 'Real brasileiro' : 'Brazilian real' })
        .waitFor();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      const text = await trigger.innerText();
      if (!text.includes(locale === 'pt-BR' ? 'Real brasileiro' : 'Brazilian real'))
        failures.push(theme + '/' + locale + ': keyboard selection failed');
      const toastParams = new URLSearchParams({
        id: 'primitives-toast--with-undo',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + toastParams);
      const undo = page.getByRole('button', { name: locale === 'pt-BR' ? 'Desfazer' : 'Undo' });
      await undo.focus();
      await page.keyboard.press('Enter');
      if (await undo.isVisible())
        failures.push(theme + '/' + locale + ': toast undo did not dismiss');
      const segmentedParams = new URLSearchParams({
        id: 'primitives-segmentedcontrol--default',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + segmentedParams);
      const firstRadio = page.getByRole('radio', {
        name: locale === 'pt-BR' ? 'Dia' : 'Day',
        exact: true,
      });
      const secondRadio = page.getByRole('radio', {
        name: locale === 'pt-BR' ? 'Noturno' : 'Night',
        exact: true,
      });
      await firstRadio.focus();
      await page.keyboard.press('ArrowRight');
      if (!(await secondRadio.isChecked()))
        failures.push(theme + '/' + locale + ': segmented control keyboard selection failed');
      const modalParams = new URLSearchParams({
        id: 'primitives-modal--closed',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + modalParams);
      const opener = page.getByRole('button', {
        name: locale === 'pt-BR' ? 'Abrir detalhes' : 'Open details',
      });
      await opener.focus();
      await page.keyboard.press('Enter');
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      if (!(await opener.evaluate((element) => element === document.activeElement)))
        failures.push(theme + '/' + locale + ': modal did not restore focus');
      const rangeParams = new URLSearchParams({
        id: 'primitives-range--default',
        globals: 'theme:' + theme + ';locale:' + locale,
      });
      await page.goto(base + '/iframe.html?' + rangeParams);
      const slider = page.getByRole('slider');
      await slider.focus();
      const before = Number(await slider.inputValue());
      await page.keyboard.press('ArrowRight');
      const after = Number(await slider.inputValue());
      if (!(after > before))
        failures.push(theme + '/' + locale + ': range keyboard adjustment failed');
      for (const [storyId, role] of [
        ['primitives-choices--unchecked', 'checkbox'],
        ['primitives-choices--toggle', 'switch'],
      ]) {
        const choiceParams = new URLSearchParams({
          id: storyId,
          globals: 'theme:' + theme + ';locale:' + locale,
        });
        await page.goto(base + '/iframe.html?' + choiceParams);
        const control = page.getByRole(role);
        await control.focus();
        await page.keyboard.press('Space');
        if (!(await control.isChecked()))
          failures.push(theme + '/' + locale + ': ' + role + ' keyboard toggle failed');
      }
    }
  }
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(
    'Passed axe for ' +
      stories.length +
      ' stories in both themes and locales, plus select, range, segmented control, checkbox, switch, modal and toast keyboard checks.',
  );
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
