import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// Run after pnpm build, against the local dist server or a deploy preview.
const base = process.argv[2] ?? 'http://127.0.0.1:8846';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors: string[] = [];
try {
  for (const width of [1440, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    for (const [route, count] of [['', 7], ['desktop/', 3], ['ios/', 7]] as const) {
      await page.goto(`${base}/skypies/${route}`);
      assert.equal(await page.locator('svg.pie-cloud').count(), count);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width} ${route}: overflow`);
      assert.ok(await page.locator('svg.pie-cloud').evaluateAll(nodes => nodes.every(svg => {
        if (!svg.getClientRects().length) return true; // Responsive layouts hide decorative clouds.
        const bounds = (svg as SVGSVGElement).getBBox();
        return bounds.width > 100 && bounds.height > 20 && Number.isFinite(Number(svg.dataset.angle));
      })), `${width} ${route}: unpainted cloud`);
      console.log(`ok: /skypies/${route} renders at ${width}px`);
    }
    await page.goto(`${base}/skypies/`);
    const cloud = page.locator('#sky .pie-cloud').first();
    await page.waitForFunction(() => document.querySelector('#sky .pie-cloud')?.getAttribute('data-motion-running') === 'true');
    const angle = () => cloud.getAttribute('data-angle');
    const waitForTurn = (previous: string | null) => page.waitForFunction(old =>
      document.querySelector('#sky .pie-cloud')?.getAttribute('data-angle') !== old, previous, { timeout: 5000 });
    let before = await angle();
    await waitForTurn(before);

    const pause = page.getByRole('button', { name: 'Pause animation', exact: true });
    await pause.click();
    before = await angle();
    await page.waitForTimeout(250);
    assert.equal(await angle(), before, 'Pause stops rotation');
    assert.equal(await page.locator('.pie-cloud[data-motion-running="true"]').count(), 0);
    assert.ok(await cloud.evaluate(svg => [svg, svg.querySelector('.code-row')!]
      .every(node => getComputedStyle(node).animationPlayState === 'paused')), 'Pause stops float and shimmer');
    await page.locator('#pie-art').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.pie-cloud[data-motion-running="true"]').count(), 0, 'Pause persists for newly visible clouds');
    await page.getByRole('button', { name: 'Resume animation', exact: true }).click();
    await cloud.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    before = await angle();
    await waitForTurn(before);

    await page.locator('#pie-art').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('#sky .pie-cloud')?.getAttribute('data-motion-running') === 'false');
    before = await angle();
    await page.waitForTimeout(250);
    assert.equal(await angle(), before, 'Offscreen clouds stop rotating');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${base}/skypies/`);
    before = await angle();
    await page.waitForTimeout(250);
    assert.equal(await angle(), before, 'Reduced motion is static on load');
    assert.equal(await cloud.evaluate(svg => getComputedStyle(svg).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(150);
    before = await angle();
    await waitForTurn(before);
    await page.locator('.site-nav').getByRole('link', { name: 'Desktop', exact: true }).click();
    await page.waitForURL('**/skypies/desktop/');
    await page.getByRole('link', { name: 'skypies, overview', exact: true }).click();
    await page.waitForURL('**/skypies/');
    await page.locator('.site-nav').getByRole('link', { name: 'iOS', exact: true }).click();
    await page.waitForURL('**/skypies/ios/');
    console.log(`ok: rotation, pause/resume, offscreen, reduced motion and navigation at ${width}px`);
    await page.close();
  }
  assert.deepEqual(errors, [], 'No browser errors');
  console.log('Skypies browser checks passed.');
} finally {
  await browser.close();
}
