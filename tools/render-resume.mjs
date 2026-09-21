// Renders profile/resume.html to a PDF with the installed Google Chrome. Waits for the web fonts before
// printing: Chrome's own --print-to-pdf fires on `load`, before the font files arrive, and the fallback font
// wraps differently (one page becomes two). Usage: node render-resume.mjs <out.pdf>
import { chromium } from 'playwright-core';

const out = process.argv[2];
if (!out) { console.error('usage: node render-resume.mjs <out.pdf>'); process.exit(2); }
const html = new URL('../profile/resume.html', import.meta.url).href;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(html, { waitUntil: 'load' });
  const faces = await page.evaluate(() => Promise.all([
    document.fonts.load('10pt "Space Grotesk"'), document.fonts.load('bold 10pt "Space Grotesk"'),
    document.fonts.load('8pt "JetBrains Mono"'), document.fonts.load('600 8pt "JetBrains Mono"'),
  ]).then(r => r.flat().length));
  if (!faces) throw new Error('web fonts did not load; the PDF would use the fallback font');
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });   // @page in resume.html sets A4 + margins
} finally {
  await browser.close();
}
