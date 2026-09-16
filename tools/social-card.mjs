// Captures site/assets/social.jpg: the briefing, fully typed, at the Open Graph size (1200x630).
//   pnpm -C tools install && node tools/social-card.mjs
import { fileURLToPath } from 'node:url';
import { launch, listen, openChapter } from './page.mjs';

const OUT = fileURLToPath(new URL('../site/assets/social.jpg', import.meta.url));
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const logged = listen(page);
  await openChapter(page, 'briefing');
  const rendered = await page.evaluate(() => document.getElementById('screen-text').textContent.includes('whoami'));
  if (!rendered || logged.length) throw new Error(`the briefing did not render cleanly; not overwriting social.jpg\n${logged.join('\n')}`);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
}
