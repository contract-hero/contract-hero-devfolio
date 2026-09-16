// Shared by the dev tools: the site URL, the browser, the chapter ids, and "open one chapter fully typed".
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const INDEX = new URL('../site/index.html', import.meta.url);
export const SITE = INDEX.href;
export const launch = () => chromium.launch({ channel: 'chrome', headless: true });   // the installed Google Chrome, no download
export const chapterIds = () => [...readFileSync(INDEX, 'utf8').matchAll(/class="chapter" id="([^"]+)"/g)].map(m => m[1]);

// Collects what the page reports: console warnings and errors, uncaught exceptions (crt.js rethrows after its
// fallback, and that never reaches the console channel) and failed or 4xx/5xx requests (a missing photo or
// font would otherwise pass as a black screen).
export function listen(page) {
  const logged = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logged.push(m.text()); });
  page.on('pageerror', e => logged.push(`uncaught: ${e.message}`));
  page.on('requestfailed', r => logged.push(`request failed: ${r.url()}`));
  page.on('response', r => { if (r.status() >= 400) logged.push(`HTTP ${r.status()} ${r.url()}`); });
  return logged;
}

// The fallback font wraps differently, so nothing may be measured before VT323 is in. document.fonts.check()
// is true for a family with no loading face, including one that never loaded; load() resolves with the faces
// that did.
export async function waitForFont(page) {
  const faces = await page.evaluate(() => document.fonts.load('16px VT323').then(f => f.length));
  if (!faces) throw new Error('VT323 did not load; measurements would use the fallback font');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));   // crt.js repaints on fonts.ready
}

// ?show=<id> pins the chapter fully typed.
export async function openChapter(page, id) {
  await page.goto(`${SITE}?show=${id}`);
  await waitForFont(page);
}
