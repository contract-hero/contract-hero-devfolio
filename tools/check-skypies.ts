import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
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
  // Light/dark app theme on every page; the overview's falling-code sky and
  // demo video, and nothing of them on the platform pages.
  for (const colorScheme of ['light', 'dark'] as const) {
    const page = await browser.newPage({ colorScheme });
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    for (const width of [375, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ['', 'desktop/', 'ios/']) {
        await page.goto(`${base}/skypies/${route}`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${colorScheme} ${width} ${route}: overflow`);
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), colorScheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 34, 31)', `${colorScheme} ${width} ${route}: page background`);
        if (route) assert.equal(await page.locator('.sky-atmosphere, #demo-video').count(), 0, `${route}: overview-only sky or video`);
      }
    }
    await page.goto(`${base}/skypies/`);
    const running = (value: 'true' | 'false') =>
      page.waitForFunction(v => document.querySelector('.sky-atmosphere')?.getAttribute('data-running') === v, value);
    await running('true');
    assert.equal(await page.locator('.sky-html-curtain span').count(), 38);
    await page.getByRole('button', { name: 'Pause animation', exact: true }).click();
    await running('false');
    await page.getByRole('button', { name: 'Resume animation', exact: true }).click();
    await running('true');
    // Reduced motion, switched live: the sky stops and the video never starts.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await running('false');
    await page.locator('#demo-video').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    assert.ok(await page.locator('video').evaluate((v: HTMLVideoElement) => v.paused && v.muted && v.controls), 'reduced motion: the demo stays paused');
    // Explicit playback stays possible (sets src directly, MP4).
    await page.locator('video').evaluate(async (v: HTMLVideoElement) => { v.src = '/skypies/media/skypies-demo.mp4'; await v.play(); });
    await page.waitForFunction(() => document.querySelector('video')!.currentTime > 0);
    // Motion allowed: the page's own <source> plays once on screen, and the
    // script pauses it offscreen; the sky stops offscreen too.
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${base}/skypies/`);
    await running('true');
    await page.locator('#demo-video').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => { const v = document.querySelector('video')!; return v.muted && !v.paused && v.currentTime > 0; });
    await page.locator('#why').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector('video')!.paused);
    await running('false');
    console.log(`ok: ${colorScheme} app themes at 375/768/1280/1920px; overview-only sky and video; sky pause/resume, offscreen, live reduced motion; MP4 playback on screen, paused offscreen`);
    if (process.env.SKYPIES_SCREENSHOTS) {
      const directory = process.env.SKYPIES_SCREENSHOTS;
      await mkdir(directory, { recursive: true });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1600 : 1300 });
        await page.goto(`${base}/skypies/`);
        await page.waitForFunction(() => document.querySelector('video')!.readyState >= 2);
        await page.waitForTimeout(250); // Let the compositor paint the resized viewport.
        await page.screenshot({ path: `${directory}/skypies-${colorScheme}-${width}.png` });
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, [], 'No browser errors');
  console.log('Skypies browser checks passed.');
} finally {
  if (errors.length) console.error(`Browser errors:\n${errors.join('\n')}`);
  await browser.close();
}
