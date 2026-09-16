// Captures site/assets/social.jpg: the briefing, fully typed, at the Open Graph size (1200x630).
//   pnpm -C tools install && node tools/social-card.mjs
import { launch, openChapter } from './page.mjs';

const OUT = new URL('../site/assets/social.jpg', import.meta.url).pathname;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await openChapter(page, 'briefing');
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await browser.close();
console.log(`wrote ${OUT}`);
