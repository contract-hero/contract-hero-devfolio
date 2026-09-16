// Shared by the dev tools: the site URL, the browser, the chapter ids, and "open one chapter fully typed".
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const INDEX = new URL('../site/index.html', import.meta.url);
export const SITE = INDEX.href;
export const launch = () => chromium.launch({ channel: 'chrome', headless: true });   // the installed Google Chrome, no download
export const chapterIds = () => [...readFileSync(INDEX, 'utf8').matchAll(/class="chapter" id="([^"]+)"/g)].map(m => m[1]);

// ?show=<id> pins the chapter fully typed. Wait for the web font (the fallback font wraps differently) and
// for the repaint crt.js schedules when it arrives.
export async function openChapter(page, id) {
  await page.goto(`${SITE}?show=${id}`);
  await page.waitForFunction(() => document.fonts.check('16px VT323'));
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
}
