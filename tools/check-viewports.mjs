// Loads every chapter at a matrix of viewports and fails when the screen leaves the viewport, a chapter
// overflows the terminal grid (--cols by --rows in style.css), the keyboard is cropped on a landscape
// display, the page logs a warning or an error, or the type gets too small to read.
//
//   pnpm -C tools install
//   node tools/check-viewports.mjs                    # table + exit code
//   node tools/check-viewports.mjs --sheet out.html   # also writes a single-file contact sheet of screenshots
//   node tools/check-viewports.mjs --only briefing,boot --sheet out.html
//
// Uses the installed Google Chrome through playwright-core (no browser download). Real device metrics
// through the context, so phone widths are honoured (headless --window-size clamps at 500px).
import { writeFileSync } from 'node:fs';
import { SITE, launch, chapterIds, openChapter } from './page.mjs';

const MIN_FONT_PX = 15;       // below this VT323 stops being comfortable on a phone
const CONCURRENCY = 4;        // viewport contexts measured at once; the geometry is static, so order does not matter

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
const chapters = chapterIds().filter(id => !only || only.includes(id));

const browser = await launch();

// Measures every chapter at one viewport: the table row, the failures and, with --sheet, the screenshots.
async function measure([name, w, h, dpr, mobile]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage();
  const logged = [];
  page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') logged.push(m.text()); });
  const failures = [], shots = [], perChapter = [];
  let worst = { rows: 0, chapter: '' }, view;
  for (const id of chapters) {
    logged.length = 0;
    await openChapter(page, id);
    const m = await page.evaluate(() => {
      const rect = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const stageEl = document.querySelector('.stage'), tube = document.querySelector('.tube');
      const stage = rect(stageEl), screen = rect(document.querySelector('.screen'));
      const prop = name => parseFloat(getComputedStyle(stageEl).getPropertyValue(name));   // the grid and the band are declared in style.css
      const cs = getComputedStyle(tube);
      const font = parseFloat(cs.fontSize), lineH = parseFloat(cs.lineHeight);
      const used = document.getElementById('screen-text').getBoundingClientRect().height / lineH;
      const avail = (tube.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lineH;
      const cols = Math.floor((tube.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / (font * prop('--adv')));
      const inside = b => b.l >= -0.5 && b.t >= -0.5 && b.r <= innerWidth + 0.5 && b.b <= innerHeight + 0.5;
      const bandTop = stage.t + prop('--band-top') * stage.h, bandBottom = stage.t + prop('--band-bottom') * stage.h;
      return {
        screen, font, used, avail, cols, wantCols: prop('--cols'), wantRows: prop('--rows'),
        bars: Math.max(0, Math.round((innerWidth - stage.w) / 2)),
        screenInside: inside(screen),
        keepComputer: prop('--keep-computer') === 1,
        computerVisible: bandTop >= -0.5 && bandBottom <= innerHeight + 0.5,
      };
    });
    view = m;
    if (m.used > worst.rows) worst = { rows: m.used, chapter: id };
    perChapter.push(`${id}=${m.used.toFixed(1)}`);
    const problems = [];
    if (!m.screenInside) problems.push('screen leaves the viewport');
    if (m.keepComputer && !m.computerVisible) problems.push('the keyboard or the top of the monitor is cropped');
    if (m.cols < m.wantCols) problems.push(`only ${m.cols} of ${m.wantCols} columns`);
    if (m.avail + 0.05 < m.wantRows) problems.push(`only ${m.avail.toFixed(1)} of ${m.wantRows} rows fit`);
    if (m.used > m.avail + 0.05) problems.push(`overflows: ${m.used.toFixed(1)} rows used, ${m.avail.toFixed(1)} available`);
    if (m.font < MIN_FONT_PX) problems.push(`font ${m.font.toFixed(1)}px < ${MIN_FONT_PX}px`);
    if (logged.length) problems.push(`console: ${logged[0]}`);
    if (problems.length) failures.push(`${name} ${w}x${h} · ${id}: ${problems.join('; ')}`);
    if (sheetPath) shots.push({ viewport: `${name} ${w}x${h}`, chapter: id, jpeg: (await page.screenshot({ type: 'jpeg', quality: 62, scale: 'css' })).toString('base64') });
  }
  await ctx.close();
  const row = [name, `${w}x${h}`, `${Math.round(view.screen.w)}x${Math.round(view.screen.h)}`, `${Math.round(100 * view.screen.w / w)}%`,
    `${view.font.toFixed(1)}px`, view.bars ? `${view.bars}px` : '-', `${worst.rows.toFixed(1)}/${view.wantRows} (${worst.chapter})`];
  return { name, w, h, row, failures, shots, perChapter };
}

// CONCURRENCY viewports at a time; results stay in VIEWPORTS order.
const results = [];
for (let i = 0; i < VIEWPORTS.length; i += CONCURRENCY) results.push(...await Promise.all(VIEWPORTS.slice(i, i + CONCURRENCY).map(measure)));
const failures = results.flatMap(r => r.failures);
const shots = results.flatMap(r => r.shots);
const rows = results.map(r => r.row);
for (const r of results) if (r === results[0] || r.name.startsWith('MacBook Air')) console.log(`rows per chapter at ${r.w}x${r.h}: ${r.perChapter.join(' ')}`);

// Behaviour pass at one laptop size: the welcome types itself, the skip link reaches the briefing, the
// briefing's last line leads into the story, and the story's last line leads back to the briefing.
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
  const screenHas = async needle => page.evaluate(n => document.getElementById('screen-text').textContent.includes(n), needle);
  // Smooth scrolling takes over a second from far away: wait for the screen, not a fixed delay.
  const clickAndExpect = async (selector, needle, msg) => {
    await page.click(selector);
    await page.waitForFunction(n => document.getElementById('screen-text').textContent.includes(n), needle, { timeout: 4000 })
      .catch(() => failures.push(`behaviour: ${msg}`));
    await page.waitForTimeout(150);
  };
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.className);
  if (focused !== 'skip') failures.push(`behaviour: first tab stop is "${focused}", expected the skip link`);
  await clickAndExpect('.skip', 'whoami', 'the skip link did not land on the briefing');
  await clickAndExpect('#screen-text a[href="#engineer"]', '1-engineer', 'the briefing\'s story link did not land on the first chapter');
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(300);
  if (!await screenHas('back to the briefing')) failures.push('behaviour: the end of the page does not show the last chapter with its return link');
  await clickAndExpect('#screen-text a[href="#briefing"]', 'whoami', 'the story\'s return link did not land on the briefing');
  const pageH = await page.evaluate(() => document.body.scrollHeight);
  console.log(`behaviour: welcome typed in ${bootMs} ms; page is ${pageH} px tall (${(pageH / 900).toFixed(1)} viewports); skip -> briefing -> story -> briefing all work`);
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
