import { cp, mkdir, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, relative, extname } from 'node:path';
import { load } from 'cheerio';
import ts from 'typescript';
import { root, origin, sources, migrateURLs } from './sources.ts';
import type { Source } from './sources.ts';

const output = fileURLToPath(new URL('dist/', root));
const cache = fileURLToPath(new URL('.cache/portfolio/', root));
await rm(output, { recursive: true, force: true });
await mkdir(cache, { recursive: true });
await cp(fileURLToPath(new URL('site/', root)), output, { recursive: true });

// Inline one TypeScript cloud renderer into each standalone Skypies page.
const cloudScript = ts.transpileModule(await readFile(new URL('tools/skypies-clouds.ts', root), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText.replaceAll('</script', '<\\/script');
const cloudStyle = await readFile(new URL('tools/skypies-clouds.css', root), 'utf8');
for (const page of ['index.html', 'desktop/index.html', 'ios/index.html']) {
  const file = join(output, 'skypies', page);
  const html = await readFile(file, 'utf8');
  const marker = /<script id="pie-cloud-builder">[\s\S]*?<\/script>/;
  if (!marker.test(html)) throw new Error(`Missing cloud builder in skypies/${page}`);
  await writeFile(file, html.replace('</head>', `<style>${cloudStyle}</style></head>`)
    .replace(marker, () => `<script id="pie-cloud-builder">${cloudScript}</script>`));
}

async function exists(path: string) { return access(path).then(() => true, () => false); }

async function fetchSource(source: Source): Promise<string> {
  if (!/^[a-f0-9]{40}$/.test(source.revision)) throw new Error(`Unpinned source: ${source.id}`);
  const directory = join(cache, `${source.id}-${source.revision}`);
  if (await exists(join(directory, '.complete'))) return directory;
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  console.log(`Fetching ${source.repo}@${source.revision.slice(0, 8)}`);
  const response = await fetch(`https://codeload.github.com/${source.repo}/tar.gz/${source.revision}`, {
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`${source.repo}: HTTP ${response.status}`);
  const archive = `${directory}.tar.gz`;
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  execFileSync('tar', ['-xzf', archive, '--strip-components=1', '-C', directory]);
  await rm(archive);
  await writeFile(join(directory, '.complete'), source.revision);
  return directory;
}

// Publish assets and reader-facing documents only. Keep authoring plans and repository internals out.
const extensions = new Set(['.html', '.css', '.js', '.mjs', '.json', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.pdf', '.txt', '.xml', '.md']);
async function copyPublic(from: string, to: string) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'superpowers', 'dapp'].includes(entry.name)) continue;
    const sourcePath = join(from, entry.name), target = join(to, entry.name);
    if (entry.isDirectory()) await copyPublic(sourcePath, target);
    else if (entry.isFile() && extensions.has(extname(entry.name))) await cp(sourcePath, target);
  }
}

const returnNav = `<div data-portfolio-nav role="navigation" aria-label="Contract Hero portfolio"><a href="/work/">← Contract Hero · Work</a><a href="/learn/">Learn</a><a href="/plugins/">Plugins</a></div>`;
const navCSS = `[data-portfolio-nav]{position:relative!important;z-index:100;display:flex!important;flex-wrap:wrap;gap:8px 24px;padding:12px 20px!important;margin:0!important;background:#0b0f0c!important;border-bottom:1px solid #245c3b;color:#b9c6bd;font:13px/1.5 system-ui,sans-serif!important;text-align:left!important;letter-spacing:normal!important;min-height:44px}[data-portfolio-nav] a{display:inline-block!important;font:inherit!important;color:#b9c6bd!important;text-decoration:underline!important;text-underline-offset:4px;background:none!important;border:0!important;padding:4px 0!important;margin:0!important;white-space:normal!important}[data-portfolio-nav] a:first-child{color:#3df08a!important}[data-portfolio-nav] a:focus-visible{outline:2px solid #3df08a;outline-offset:4px}`;

async function processFiles(directory: string, source: Source) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) { await processFiles(file, source); continue; }
    if (!['.html', '.css', '.js', '.mjs', '.xml'].includes(extname(file))) continue;
    let content = migrateURLs(await readFile(file, 'utf8'));
    if (source.id === 'display-v2') content = content.replaceAll('/display-v2-forum/', '/display-v2/');
    if (extname(file) === '.html') {
      const $ = load(content);
      const path = '/' + relative(output, file).replaceAll('\\', '/').replace(/index\.html$/, '');
      const canonical = origin + (source.id === 'sui-dapp-testing' ? `/${source.mount}/` : path);
      $('link[rel="canonical"],meta[property="og:url"]').remove();
      $('head').append(`<link rel="canonical" href="${canonical}"><meta property="og:url" content="${canonical}">`);
      // Migrate navigation to this preview/production host, while metadata remains canonical.
      $('a[href],img[src],video[src],source[src],script[src],link[href]').each((_, el) => {
        if ($(el).attr('rel') === 'canonical') return;
        for (const attr of ['href', 'src']) {
          const value = $(el).attr(attr);
          if (value?.startsWith(origin + '/')) $(el).attr(attr, value.slice(origin.length));
        }
      });
      for (const attr of ['og:image', 'twitter:image']) {
        $(`meta[property="${attr}"],meta[name="${attr}"]`).each((_, el) => {
          const value = $(el).attr('content');
          if (value?.startsWith('/')) $(el).attr('content', origin + value);
        });
      }
      $('head').append(`<style>${navCSS}</style>`);
      $('body').prepend(returnNav);
      if (source.id === 'display-v2') {
        $('title').text('Hero Forge — Sui Display V2 demo | Contract Hero');
        $('body').prepend('<div data-portfolio-nav>Interactive teaching demo · Sui devnet · uses test assets</div>');
      }
      if (source.id === 'sui-dapp-testing') {
        $('body').prepend('<div data-portfolio-nav>Workshop setup guide. For the maintained setup and testing workflow, use <a href="/sui-pilot/">Sui Pilot</a>.</div>');
      }
      // Naming-only cleanup from the old marketplace; install commands and source links stay intact.
      if (source.id === 'plugins') {
        $('p').each((_, el) => { $(el).html($(el).html()!.replaceAll('812 bundled', '800+ bundled')); });
        $('#vlerv').html('<span id="skypies"></span><h3>skypies</h3><p>Open and organize the files your agents produce, and share artifacts between paired devices with the Skypies app and plugin.</p><div class="cmd">/plugin install skypies@contract-hero</div><div class="card-links"><a href="/skypies/">Skypies</a><a href="https://github.com/contract-hero/skypies-plugin">Source</a></div>');
        $('footer [data-todo]').each((_, el) => {
          if ($(el).text().trim().toLowerCase() === 'vlerv') $(el).replaceWith('<a href="/skypies/">skypies</a>');
        });
        $('footer a').each((_, el) => {
          if ($(el).text().trim().toLowerCase() === 'vlerv') $(el).attr('href', '/skypies/').text('skypies');
        });
      }
      content = $.html();
    }
    await writeFile(file, content);
  }
}

// Bound concurrency so the build does not download every project's videos at once.
for (let i = 0; i < sources.length; i += 3) {
  await Promise.all(sources.slice(i, i + 3).map(async source => {
    const checkout = await fetchSource(source);
    const target = join(output, source.mount);
    await copyPublic(join(checkout, source.directory), target);
    for (const extra of source.extras ?? []) await cp(join(checkout, extra), join(target, extra));
    // The old guide index was only a meta refresh; serve the actual guide at its clean new URL.
    if (source.id === 'sui-dapp-testing') await cp(join(target, 'chrome-mcp-slush-setup.html'), join(target, 'index.html'));
    await access(join(target, 'index.html')); // Never publish an empty replacement site.
    await processFiles(target, source);
    console.log(`Assembled /${source.mount}/`);
  }));
}

// Only curated entry points belong in the sitemap; supporting documents still have their own canonicals.
const paths = ['/', '/work/', '/learn/', '/work/evm-sui/', '/work/hashi/', '/work/deepbook/', '/work/flow/', '/skypies/', ...sources.map(s => `/${s.mount}/`)];
await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>\n`);
await writeFile(join(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
console.log(`Built ${sources.length} project sites plus the portfolio into dist/`);
