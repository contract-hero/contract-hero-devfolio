// Captures site/assets/social.jpg: the briefing, fully typed, at the Open Graph size (1200x630).
//   pnpm -C tools install && node tools/social-card.mjs
import { chromium } from 'playwright-core';
const SITE = new URL('../site/index.html', import.meta.url).href;
const OUT = new URL('../site/assets/social.jpg', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${SITE}?show=briefing`);
await page.waitForFunction(() => document.fonts.check('16px VT323'));
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await browser.close();
console.log(`wrote ${OUT}`);
