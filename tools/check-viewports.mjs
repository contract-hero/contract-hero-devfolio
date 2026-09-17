// Loads every chapter at a matrix of viewports and fails when the screen leaves the viewport, a chapter
// overflows the terminal grid (--cols by --rows in style.css) in either direction, the keyboard is cropped on
// a landscape display, the side fade is missing where the photo is narrower than the viewport, the page logs
// a warning, an error, an uncaught exception or a failed request, or the type gets too small to read. Then a
// behaviour pass drives the live page: the welcome self-types, a resize keeps the screen, the skip link and
// the two in-screen links land where they say, focus never enters the hidden chapters, old deep-link ids
// still resolve, an unknown ?show id paints its error, reduced motion shows the welcome complete, and the
// no-JS page renders.
//
//   pnpm -C tools install
//   node tools/check-viewports.mjs                    # table + exit code
//   node tools/check-viewports.mjs --sheet out.html   # also writes a single-file contact sheet of screenshots
//   node tools/check-viewports.mjs --only briefing,boot --sheet out.html
//
// Uses the installed Google Chrome through playwright-core (no browser download). Real device metrics
// through the context, so phone widths are honoured (headless --window-size clamps at 500px).
import { readFileSync, writeFileSync } from 'node:fs';
import { SITE, launch, listen, chapterIds, openChapter, waitForFont } from './page.mjs';

const MIN_FONT_PX = 15;       // below this VT323 stops being comfortable on a phone
const CONCURRENCY = 4;        // viewport contexts measured at once; the geometry is static, so order does not matter
const BOOT_BUDGET_MS = 7000;  // the welcome self-types in ~4.5 s; wall-clock, so leave headroom

// name, width, height, deviceScaleFactor, mobile
const VIEWPORTS = [
  ['Android small', 360, 640, 3, true],
  ['iPhone SE', 375, 667, 2, true],
  ['iPhone 15', 393, 852, 3, true],
  ['iPhone 15 Pro Max', 430, 932, 3, true],
  ['21:9 phone', 412, 960, 3, true],
  ['phone landscape', 852, 393, 3, true],
  ['iPad portrait', 768, 1024, 2, true],
  ['iPad landscape', 1024, 768, 2, true],
  ['iPad Pro 12.9 portrait', 1024, 1366, 2, true],
  ['laptop 1280x800', 1280, 800, 2, false],
  ['MacBook Air 1440x900', 1440, 900, 2, false],
  ['MacBook Pro 14 1512x982', 1512, 982, 2, false],
  ['1080p', 1920, 1080, 1, false],
  ['QHD 2560x1440', 2560, 1440, 1, false],
  ['ultrawide 2560x1080', 2560, 1080, 1, false],
  ['ultrawide 3440x1440', 3440, 1440, 1, false],
  ['tall window 800x1200', 800, 1200, 2, false],
  ['square window 1000x1000', 1000, 1000, 2, false],
];

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const sheetPath = opt('--sheet');
const only = opt('--only')?.split(',');
const allIds = chapterIds();
const chapters = allIds.filter(id => !only || only.includes(id));
if (!chapters.length) { console.error(`--only matched no chapter; ids: ${allIds.join(', ')}`); process.exit(2); }

const failures = [];
// Static: every alias in crt.js must name a live chapter, or old deep links die silently.
const crtSource = readFileSync(new URL('../site/crt.js', import.meta.url), 'utf8');
const aliasBlock = crtSource.match(/const ALIASES = \{([\s\S]*?)\};/)?.[1] ?? '';
for (const [, id] of aliasBlock.matchAll(/: '(\w+)'/g)) if (!allIds.includes(id)) failures.push(`crt.js ALIASES points at "${id}", which is not a chapter id`);

const browser = await launch();
const screenText = page => page.evaluate(() => document.getElementById('screen-text').textContent);

// Measures every chapter at one viewport: the table row, the failures and, with --sheet, the screenshots.
async function measure([name, w, h, dpr, mobile]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const logged = listen(page);
  const failures = [], shots = [], perChapter = [], texts = new Set();
  let worst = { rows: 0, chapter: '' }, view;
  for (const id of chapters) {
    logged.length = 0;
    await openChapter(page, id);
    const m = await page.evaluate(() => {
      const rect = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const stageEl = document.querySelector('.stage'), tube = document.querySelector('.tube'), text = document.getElementById('screen-text');
      const stage = rect(stageEl), screen = rect(document.querySelector('.screen'));
      // The grid and the band are declared in style.css; a renamed property must fail loudly, not compare against NaN.
      const prop = n => { const v = parseFloat(getComputedStyle(stageEl).getPropertyValue(n)); if (!Number.isFinite(v)) throw new Error(`style.css no longer declares ${n}`); return v; };
      const cs = getComputedStyle(tube);
      const font = parseFloat(cs.fontSize), lineH = parseFloat(cs.lineHeight);
      const used = text.getBoundingClientRect().height / lineH;
      const avail = (tube.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lineH;
      const cols = Math.floor((tube.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / (font * prop('--adv')));
      const inside = b => b.l >= -0.5 && b.t >= -0.5 && b.r <= innerWidth + 0.5 && b.b <= innerHeight + 0.5;
      const bandTop = stage.t + prop('--band-top') * stage.h, bandBottom = stage.t + prop('--band-bottom') * stage.h;
      const img = getComputedStyle(document.querySelector('.stage img'));
      return {
        screen, font, used, avail, cols, wantCols: prop('--cols'), wantRows: prop('--rows'),
        text: text.textContent.trim(),
        bars: Math.max(0, Math.round((innerWidth - stage.w) / 2)),
        bands: Math.max(0, Math.round((innerHeight - stage.h) / 2)),
        faded: (img.maskImage || img.webkitMaskImage || 'none') !== 'none',
        screenInside: screen.w > 0 && inside(screen),                     // an all-zero rect (display:none) must not read as inside
        wide: text.scrollWidth > tube.clientWidth,                        // <pre> never wraps: art wider than the grid is clipped silently
        keepComputer: prop('--keep-computer') === 1,
        computerVisible: bandTop >= -0.5 && bandBottom <= innerHeight + 0.5,
      };
    });
    view = m;
    texts.add(m.text);
    if (m.used > worst.rows) worst = { rows: m.used, chapter: id };
    perChapter.push(`${id}=${m.used.toFixed(1)}`);
    const problems = [];
    if (!m.screenInside) problems.push('screen leaves the viewport');
    if (m.keepComputer && !m.computerVisible) problems.push('the keyboard or the top of the monitor is cropped');
    if ((m.bars > 0 || m.bands > 0) && !m.faded) problems.push('the photo does not fill the viewport and the fade mask is off');
    if (m.cols < m.wantCols) problems.push(`only ${m.cols} of ${m.wantCols} columns`);
    if (m.avail + 0.05 < m.wantRows) problems.push(`only ${m.avail.toFixed(1)} of ${m.wantRows} rows fit`);
    if (m.used > m.avail + 0.05) problems.push(`overflows: ${m.used.toFixed(1)} rows used, ${m.avail.toFixed(1)} available`);
    if (m.wide) problems.push('text wider than the screen');
    if (m.font < MIN_FONT_PX) problems.push(`font ${m.font.toFixed(1)}px < ${MIN_FONT_PX}px`);
    if (logged.length) problems.push(`page reported: ${logged[0]}`);
    if (problems.length) failures.push(`${name} ${w}x${h} · ${id}: ${problems.join('; ')}`);
    if (sheetPath) shots.push({ viewport: `${name} ${w}x${h}`, chapter: id, jpeg: (await page.screenshot({ type: 'jpeg', quality: 62, scale: 'css' })).toString('base64') });
  }
  if (texts.size !== chapters.length) failures.push(`${name} ${w}x${h}: ${texts.size} distinct screens for ${chapters.length} chapters; ?show= did not pin them`);
  await ctx.close();
  const row = [name, `${w}x${h}`, `${Math.round(view.screen.w)}x${Math.round(view.screen.h)}`, `${Math.round(100 * view.screen.w / w)}%`,
    `${view.font.toFixed(1)}px`, view.bars ? `${view.bars}px` : view.bands ? `${view.bands}px v` : '-', `${worst.rows.toFixed(1)}/${view.wantRows} (${worst.chapter})`];
  return { name, w, h, row, failures, shots, perChapter };
}

// Drives the live page at one laptop size.
async function behaviour() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const logged = listen(page);
  const fail = msg => failures.push(`behaviour: ${msg}`);
  const has = async needle => (await screenText(page)).includes(needle);
  const waitFor = (needle, msg, timeout = 4000) => page.waitForFunction(n => document.getElementById('screen-text').textContent.includes(n), needle, { timeout })
    .then(() => true, e => { fail(e.name === 'TimeoutError' ? msg : e.message); return false; });
  const clickAndExpect = async (selector, needle, msg) => {
    // Smooth scrolling takes over a second from far away: wait for the screen, not a fixed delay.
    const clicked = await page.click(selector, { timeout: 4000 }).then(() => true, e => { fail(`${msg} (${e.message.split('\n')[0]})`); return false; });
    if (clicked) await waitFor(needle, msg);
    await page.waitForTimeout(150);
  };

  await page.goto(SITE);
  await waitForFont(page);
  const t0 = Date.now();
  const typed = await waitFor('scroll down to find out', 'the welcome did not finish typing within 8 s', 8000);
  const bootMs = Date.now() - t0;
  if (typed && bootMs > BOOT_BUDGET_MS) fail(`the welcome took ${bootMs} ms to type; budget is ${BOOT_BUDGET_MS} ms`);

  // A resize must keep the chapter on screen (the welcome is self-typed, so its scroll run is zero).
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(250);
  if (!await has('scroll down to find out')) fail('a resize left the welcome screen');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(250);

  // Keyboard: the first tab stop is the skip link, and focus never enters the hidden chapters.
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className);
  if (focused !== 'skip') fail(`first tab stop is "${focused}", expected the skip link`);
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => !!document.activeElement?.closest('#chapters'))) { fail('Tab reached a link inside the hidden chapters'); break; }
  }

  // The power button (easter egg) is the next tab stop; Enter turns the screen off and on, the LED follows.
  await page.focus('.power'); await page.keyboard.press('Enter'); await page.waitForTimeout(900);
  const off = await page.evaluate(() => ({ stage: document.querySelector('.stage').classList.contains('off'),
    pressed: document.querySelector('.power').getAttribute('aria-pressed'), tube: getComputedStyle(document.querySelector('.tube')).opacity }));
  if (!off.stage || off.pressed !== 'false' || off.tube !== '0') fail(`power off did not black the screen: ${JSON.stringify(off)}`);
  await page.keyboard.press('Enter'); await page.waitForTimeout(1100);
  if (await page.evaluate(() => document.querySelector('.stage').className !== 'stage')) fail('power on did not clear the off and waking states');

  await page.focus('.skip');   // the skip link is visible only while focused
  await clickAndExpect('.skip', 'whoami', 'the skip link did not land on the briefing');
  await clickAndExpect('#screen-text a[href="#engineer"]', '1-engineer', "the briefing's story link did not land on the first chapter");
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
  if (!await has('back to the briefing')) fail('the end of the page does not show the last chapter with its return link');
  await clickAndExpect('#screen-text a[href="#briefing"]', 'whoami', "the story's return link did not land on the briefing");
  const pageH = await page.evaluate(() => document.body.scrollHeight);

  // Old deep links resolve through ALIASES.
  await page.goto(`${SITE}#y2017`);
  await waitForFont(page);
  await waitFor('3-classroom', 'the old deep link #y2017 did not land on the classroom chapter');
  if (logged.length) fail(`the page reported: ${logged[0]}`);

  // An unknown ?show id paints its error and logs exactly one console error.
  logged.length = 0;
  await page.goto(`${SITE}?show=nope`);
  await page.waitForTimeout(200);
  if (!await has('unknown chapter: nope')) fail('?show=nope did not paint the unknown-chapter error');
  if (logged.length !== 1 || !logged[0].includes('not a chapter id')) fail(`?show=nope should log one console error, got: ${logged.join(' | ') || 'nothing'}`);
  await ctx.close();
  console.log(`behaviour: welcome typed in ${bootMs} ms; page is ${pageH} px tall (${(pageH / 900).toFixed(1)} viewports); resize, skip, story, return, alias and error paths all pass`);
}

// Reduced motion: the welcome appears complete without typing, and the page stays silent.
async function reducedMotion() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const logged = listen(page);
  await page.goto(SITE);
  await waitForFont(page);
  await page.waitForTimeout(600);
  if (!await (await screenText(page)).includes('scroll down to find out')) failures.push('reduced motion: the welcome is not complete without typing');
  if (logged.length) failures.push(`reduced motion: the page reported: ${logged[0]}`);
  await ctx.close();
}

// No JavaScript: the chapters render as a plain page and the scene is hidden.
async function noJs() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(SITE);
  const m = await page.evaluate(() => ({
    chapters: document.getElementById('chapters').getBoundingClientRect().height,
    scene: getComputedStyle(document.querySelector('.scene')).display,
    inert: document.getElementById('chapters').inert,
  }));
  if (!(m.chapters > 300)) failures.push('no-JS: the chapters are not rendered as a page');
  if (m.scene !== 'none') failures.push('no-JS: the scene is still displayed');
  if (m.inert) failures.push('no-JS: the chapters are inert');
  await ctx.close();
}

let results = [];
try {
  // CONCURRENCY viewports at a time; results stay in VIEWPORTS order.
  for (let i = 0; i < VIEWPORTS.length; i += CONCURRENCY) results.push(...await Promise.all(VIEWPORTS.slice(i, i + CONCURRENCY).map(measure)));
  for (const r of results) if (r === results[0] || r.name.startsWith('MacBook Air')) console.log(`rows per chapter at ${r.w}x${r.h}: ${r.perChapter.join(' ')}`);
  await behaviour();
  await Promise.all([reducedMotion(), noJs()]);
} finally {
  await browser.close();
}
failures.push(...results.flatMap(r => r.failures));
const shots = results.flatMap(r => r.shots);
const rows = results.map(r => r.row);

const head = ['viewport', 'size', 'screen px', 'screen/vw', 'font', 'bars', 'rows used (worst chapter)'];
const widths = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
const line = r => r.map((c, i) => c.padEnd(widths[i])).join('  ');
console.log(line(head)); console.log(widths.map(w => '-'.repeat(w)).join('  '));
rows.forEach(r => console.log(line(r)));
console.log(`\n${chapters.length} chapters x ${VIEWPORTS.length} viewports; ${failures.length} failure(s)`);
failures.forEach(f => console.log('  FAIL ' + f));

if (sheetPath) {
  const byViewport = new Map();
  for (const s of shots) { if (!byViewport.has(s.viewport)) byViewport.set(s.viewport, []); byViewport.get(s.viewport).push(s); }
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const sections = [...byViewport].map(([vp, list]) => `
    <section><h2>${esc(vp)}</h2><div class="row">${list.map(s => `<figure><img src="data:image/jpeg;base64,${s.jpeg}" alt="${esc(vp)} ${esc(s.chapter)}"><figcaption>${esc(s.chapter)}</figcaption></figure>`).join('')}</div></section>`).join('');
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>contracthero.dev viewport sheet</title>
<style>body{margin:0;padding:24px;background:#111;color:#ddd;font:15px/1.4 system-ui,sans-serif}h1{font-size:20px;margin:0 0 6px}p{margin:0 0 20px;color:#999}h2{font-size:15px;margin:28px 0 8px;color:#9dffb0}
.row{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}figure{margin:0;flex:0 0 auto}img{display:block;height:260px;width:auto;border:1px solid #333;background:#000}figcaption{font-size:12px;color:#888;margin-top:4px}
pre{background:#000;color:#9dffb0;padding:12px;overflow:auto;font-size:12px}</style></head><body>
<h1>contracthero.dev — every chapter at every viewport</h1><p>Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} by tools/check-viewports.mjs. Each image is a real render of the page at that viewport (device pixel ratio honoured).</p>
<pre>${esc([line(head), ...rows.map(line)].join('\n'))}\n\n${failures.length ? failures.map(f => 'FAIL ' + f).join('\n') : 'no failures'}</pre>${sections}</body></html>`;
  writeFileSync(sheetPath, html);
  console.log(`sheet: ${sheetPath} (${(html.length / 1e6).toFixed(1)} MB)`);
}
process.exit(failures.length ? 1 : 0);
