// Loads every chapter at a matrix of viewports and fails when the screen leaves the viewport, a chapter
// overflows the 46x12 grid, the corner control touches the screen, or the type gets too small to read.
//
//   pnpm -C tools install
//   node tools/check-viewports.mjs                 # table + exit code
//   node tools/check-viewports.mjs --sheet out.html   # also writes a single-file contact sheet of screenshots
//   node tools/check-viewports.mjs --only briefing,boot --sheet out.html
//
// Uses the installed Google Chrome through playwright-core (no browser download). Real device metrics
// through the context, so phone widths are honoured (headless --window-size clamps at 500px).
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';

const SITE = new URL('../site/index.html', import.meta.url).href;
const MIN_FONT_PX = 15;       // below this VT323 stops being comfortable on a phone
const ROWS = 12;

// name, width, height, deviceScaleFactor, mobile
const VIEWPORTS = [
  ['Android small', 360, 640, 3, true],
  ['iPhone SE', 375, 667, 2, true],
  ['iPhone 15', 393, 852, 3, true],
  ['iPhone 15 Pro Max', 430, 932, 3, true],
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

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const probe = await browser.newPage();
await probe.goto(SITE);
const chapters = (await probe.$$eval('.chapter', els => els.map(e => e.id))).filter(id => !only || only.includes(id));
await probe.close();

const failures = [];
const shots = [];   // { viewport, chapter, jpegBase64 }
const rows = [];
for (const [name, w, h, dpr, mobile] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const warnings = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text()); });
  // Warm the web font in this context first: the overflow numbers mean nothing in the fallback font.
  await page.goto(SITE);
  await page.evaluate(() => document.fonts.load('16px VT323'));
  let worst = { rows: 0, chapter: '' }, screen, font, bars, first = true;
  const perChapter = [];
  for (const id of chapters) {
    warnings.length = 0;
    await page.goto(`${SITE}?show=${id}`);
    await page.waitForFunction(() => document.fonts.check('16px VT323'));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const m = await page.evaluate(() => {
      const r = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const screen = r(document.querySelector('.screen'));
      const stage = r(document.querySelector('.stage'));
      const jump = r(document.getElementById('jump'));
      const tube = document.querySelector('.tube');
      const cs = getComputedStyle(tube);
      const text = document.getElementById('screen-text');
      const font = parseFloat(cs.fontSize), lineH = parseFloat(cs.lineHeight);
      const used = text.getBoundingClientRect().height / lineH;
      const avail = (tube.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lineH;
      const cols = Math.floor((tube.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / (font * 0.4));
      const vw = innerWidth, vh = innerHeight;
      const inside = b => b.l >= -0.5 && b.t >= -0.5 && b.r <= vw + 0.5 && b.b <= vh + 0.5;
      const overlap = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
      // the computer (wall above the bezel to the desk edge) as fractions of the photo height; must be visible on landscape screens
      const bandTop = stage.t + .22 * stage.h, bandBottom = stage.t + .80 * stage.h;
      const bars = Math.max(0, Math.round((vw - stage.w) / 2));
      return { vw, vh, screen, jump, font, lineH, used, avail, cols, bars, computerVisible: bandTop >= -0.5 && bandBottom <= vh + 0.5,
               screenInside: inside(screen), jumpInside: inside(jump), jumpHitsScreen: overlap(jump, screen) };
    });
    if (first) { screen = m.screen; font = m.font; bars = m.bars; first = false; }
    if (m.used > worst.rows) worst = { rows: m.used, chapter: id };
    perChapter.push(`${id}=${m.used.toFixed(1)}`);
    const problems = [];
    if (!m.screenInside) problems.push('screen leaves the viewport');
    if (!m.jumpInside) problems.push('corner control leaves the viewport');
    if (m.jumpHitsScreen) problems.push('corner control overlaps the screen');
    if (w > h && h >= 500 && !m.computerVisible) problems.push('the keyboard or the top of the monitor is cropped');
    if (m.used > m.avail + 0.05) problems.push(`overflows: ${m.used.toFixed(1)} rows used, ${m.avail.toFixed(1)} available`);
    if (warnings.some(t => t.includes('overflows the tube'))) problems.push('crt.js warned about overflow');
    if (m.cols < 46) problems.push(`only ${m.cols} columns`);
    if (m.font < MIN_FONT_PX) problems.push(`font ${m.font.toFixed(1)}px < ${MIN_FONT_PX}px`);
    if (problems.length) failures.push(`${name} ${w}x${h} · ${id}: ${problems.join('; ')}`);
    if (sheetPath) shots.push({ viewport: `${name} ${w}x${h}`, chapter: id, jpeg: (await page.screenshot({ type: 'jpeg', quality: 62, scale: 'css' })).toString('base64') });
  }
  rows.push([name, `${w}x${h}`, `${Math.round(screen.w)}x${Math.round(screen.h)}`, `${Math.round(100 * screen.w / w)}%`, `${font.toFixed(1)}px`, bars ? `${bars}px` : '-', `${worst.rows.toFixed(1)}/${ROWS} (${worst.chapter})`]);
  if (rows.length === 1 || name.startsWith('MacBook Air')) console.log(`rows per chapter at ${w}x${h}: ${perChapter.join(' ')}`);
  await ctx.close();
}
// Behaviour pass at one laptop size: the welcome types itself, the corner control leads to the briefing,
// into the story from the briefing, and back to the briefing from the end of the story.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(SITE);
  await page.waitForFunction(() => document.fonts.check('16px VT323'));
  const t0 = Date.now();
  await page.waitForFunction(() => document.getElementById('screen-text').textContent.includes('scroll down to find out'), null, { timeout: 8000 })
    .catch(() => failures.push('behaviour: the welcome did not finish typing within 8 s'));
  const bootMs = Date.now() - t0;
  if (bootMs > 5500) failures.push(`behaviour: the welcome took ${bootMs} ms to type; budget is 5.5 s`);
  const jumpText = () => page.evaluate(() => document.getElementById('jump').textContent);
  const screenHas = async needle => page.evaluate(n => document.getElementById('screen-text').textContent.includes(n), needle);
  const expectJump = async (want, where) => { const got = await jumpText(); if (got !== want) failures.push(`behaviour: corner control reads "${got}" ${where}; expected "${want}"`); };
  // Smooth scrolling from the end of the page takes over a second in Chrome: wait for the screen, not a fixed delay.
  const clickAndExpect = async (needle, msg) => {
    await page.click('#jump');
    await page.waitForFunction(n => document.getElementById('screen-text').textContent.includes(n), needle, { timeout: 4000 })
      .catch(() => failures.push(`behaviour: ${msg}`));
    await page.waitForTimeout(150);
  };
  await expectJump('> briefing', 'on the welcome');
  await clickAndExpect('whoami', '"> briefing" did not land on the briefing');
  await expectJump('> story', 'on the briefing');
  await clickAndExpect('1-engineer', '"> story" did not land on the first story chapter');
  await expectJump('> briefing', 'on a story chapter');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
  if (!await screenHas('5-solutions')) failures.push('behaviour: the end of the page does not show the last chapter');
  await expectJump('> briefing', 'on the last chapter');
  await clickAndExpect('whoami', '"> briefing" from the end did not land on the briefing');
  const pageH = await page.evaluate(() => document.body.scrollHeight);
  console.log(`behaviour: welcome typed in ${bootMs} ms; page is ${pageH} px tall (${(pageH / 900).toFixed(1)} viewports); corner control routes welcome -> briefing -> story -> briefing`);
  await ctx.close();
}
await browser.close();

const head = ['viewport', 'size', 'screen px', 'screen/vw', 'font', 'side bars', 'rows used (worst chapter)'];
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
