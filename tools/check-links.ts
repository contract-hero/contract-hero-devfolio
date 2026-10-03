import { readFile, readdir, access } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'cheerio';
import { root, origin, sources } from './sources.ts';

const directory = fileURLToPath(new URL('dist/', root));
const failures = new Set<string>();
const files: string[] = [];
async function walk(path: string) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const next = join(path, entry.name);
    if (entry.isDirectory()) await walk(next);
    else files.push(relative(directory, next));
  }
}
await walk(directory);
const fileSet = new Set(files);
const htmlPages = new Map<string, ReturnType<typeof load>>();
for (const file of files.filter(f => f.endsWith('.html'))) htmlPages.set(file, load(await readFile(join(directory, file), 'utf8')));

function resolve(url: URL): string | undefined {
  const path = decodeURIComponent(url.pathname).replace(/^\//, '');
  return [path, path + 'index.html', path + '/index.html', path + '.html'].find(p => fileSet.has(p));
}

let links = 0;
for (const [file, $] of htmlPages) {
  const pageURL = new URL('/' + file, origin);
  const canonical = $('link[rel="canonical"]').attr('href');
  // Leave the legacy app handoff pages unchanged; they intentionally do not advertise a canonical.
  if (!/^(skypiesai|skypieai|vlerv)\/l\//.test(file)) {
    if (!canonical?.startsWith(origin + '/')) failures.add(`${file}: missing or foreign canonical (${canonical})`);
  }
  $('a[href],link[href],img[src],script[src],iframe[src],video[src],source[src],video[poster]').each((_, el) => {
    for (const attr of ['href', 'src', 'poster']) {
      const value = $(el).attr(attr);
      if (!value || /^(data:|mailto:|tel:|javascript:|skypies:|vlerv:)/.test(value)) continue;
      if (/https:\/\/(contract-hero|alilloig)\.github\.io/.test(value)) failures.add(`${file}: old Pages dependency ${value}`);
      const url = new URL(value, pageURL);
      if (url.origin !== origin) continue;
      const target = resolve(url);
      links++;
      if (!target) { failures.add(`${file}: missing ${attr}=${value}`); continue; }
      if (url.hash && url.hash !== '#' && htmlPages.has(target)) {
        // App handoffs consume structured fragments; the CRT renders legacy chapter IDs dynamically.
        if (url.hash.includes('?') || target === 'index.html' || /^(skypiesai|skypieai|vlerv)\//.test(target)) continue;
        const id = decodeURIComponent(url.hash.slice(1));
        const targetPage = htmlPages.get(target)!;
        if (!targetPage('[id]').toArray().some(e => targetPage(e).attr('id') === id)) failures.add(`${file}: missing anchor ${value}`);
      }
    }
  });
}
for (const file of files.filter(f => extname(f) === '.css')) {
  const css = await readFile(join(directory, file), 'utf8');
  for (const [, value] of css.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
    if (/^(data:|#)/.test(value)) continue;
    const url = new URL(value, new URL('/' + file, origin));
    if (url.origin === origin && !resolve(url)) failures.add(`${file}: missing CSS asset ${value}`);
  }
}
for (const source of sources) await access(join(directory, source.mount, 'index.html'));
for (const path of ['work', 'learn', 'work/evm-sui', 'work/hashi', 'work/deepbook', 'work/flow']) await access(join(directory, path, 'index.html'));
// Byte-for-byte preservation of the sensitive app handoff pages and CRT runtime/assets.
for (const file of ['crt.js', 'style.css', 'assets/room.jpg', 'resume.pdf', 'skypiesai/l/index.html', 'skypieai/l/index.html', 'vlerv/l/index.html']) {
  const before = await readFile(new URL(`site/${file}`, root));
  if (!before.equals(await readFile(join(directory, file)))) failures.add(`Preserved file changed in build: ${file}`);
}
console.log(`Checked ${htmlPages.size} HTML pages, ${links} local references, CSS assets and preserved files.`);
if (failures.size) { console.error([...failures].join('\n')); process.exitCode = 1; }
else console.log('All local links and assets resolve; all published pages have the intended canonical host.');
