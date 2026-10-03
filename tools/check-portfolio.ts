import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = process.argv[2] ?? 'http://127.0.0.1:8834';
const screenshots = process.env.SCREENSHOTS;
if (screenshots) await mkdir(screenshots, { recursive: true });
const paths = ['/work/', '/learn/', '/work/evm-sui/', '/work/hashi/', '/work/deepbook/', '/work/flow/', '/plugins/', '/plugins/plugins.html', '/sui-pilot/', '/sui-pilot/formal-verification.html', '/code-forge/', '/agentic-community-college/', '/acc-deepbook-course/', '/acc-deepbook-course/lessons/01-place-and-manage-orders.html', '/acc-evm-wal/', '/acc-evm-wal/01-walrus-solidity-basics.html', '/deepbook-snippets/', '/display-v2/', '/learn/sui-dapp-testing/', '/skypies/'];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const failures: string[] = [];
for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 500 });
  const page = await context.newPage();
  let current = '';
  page.on('pageerror', error => failures.push(`${width} ${current}: ${error.message}`));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) failures.push(`${width} ${current}: HTTP ${response.status()} ${response.url()}`);
  });
  for (const path of paths) {
    current = path;
    await page.goto(base + path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({
      title: document.title,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      text: document.body.innerText.trim().length,
      broken: [...document.images].filter(img => img.complete && img.naturalWidth === 0 && img.currentSrc).map(img => img.currentSrc),
    }));
    if (!state.title || state.text < 80) failures.push(`${width} ${path}: page did not render`);
    if (state.overflow) failures.push(`${width} ${path}: horizontal overflow`);
    if (state.broken.length) failures.push(`${width} ${path}: broken images ${state.broken.join(', ')}`);
    console.log(`${width} ${path}: ${state.title}`);
    if (screenshots && ['/work/', '/learn/', '/plugins/', '/display-v2/'].includes(path)) await page.screenshot({ path: `${screenshots}/${path.replaceAll('/', '')}-${width}.png`, fullPage: path === '/work/' });
  }
  // Use the real catalog navigation, including the CRT entry point and supporting experiment placement.
  await page.goto(base + '/?show=briefing');
  await page.locator('#screen-text a[href="/work/"]').click();
  await page.waitForURL('**/work/');
  await page.getByRole('link', { name: 'Learn something', exact: true }).click();
  await page.waitForURL('**/learn/');
  await page.getByRole('navigation', { name: 'Portfolio', exact: true }).getByRole('link', { name: 'Plugins', exact: true }).click();
  await page.waitForURL('**/plugins/');
  await page.getByRole('link', { name: '← Contract Hero · Work', exact: true }).click();
  await page.waitForURL('**/work/');
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => document.activeElement?.tagName);
  if (focus !== 'A') failures.push(`${width}: keyboard navigation did not reach a link`);
  await context.close();
}
await browser.close();
console.log(`Checked ${paths.length} routes at desktop and phone widths, plus the homepage → work → learn → plugins → work journey.`);
if (failures.length) { console.error([...new Set(failures)].join('\n')); process.exitCode = 1; }
else console.log('All portfolio browser checks passed.');
