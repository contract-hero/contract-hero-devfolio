// Generates compatibility pages only. This command does not push or change GitHub Pages settings.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root, origin, sources } from './sources.ts';

const directory = fileURLToPath(new URL('.cache/legacy-pages/', root));
const projects = [
  ...sources.map(s => ({ repo: s.repo, from: '/' + s.repo.split('/')[1], to: '/' + s.mount })),
  { repo: 'contract-hero/contract-hero-devfolio', from: '/contract-hero-devfolio', to: '' },
  { repo: 'alilloig/artifacts', from: '/artifacts', to: '/work' },
  { repo: 'contract-hero/contract-hero.github.io', from: '', to: '/work' },
];
const routes = [...projects.filter(p => p.from), { from: '/skypies-core', to: '/skypies' }].sort((a, b) => b.from.length - a.from.length);
const script = `
const routes = ${JSON.stringify(routes.map(({ from, to }) => ({ from, to })))};
const path = location.pathname.replace(/\\/index\\.html$/, '/');
const route = routes.find(r => path === r.from || path.startsWith(r.from + '/'));
let next = route ? route.to + path.slice(route.from.length) : '/work/';
const destination = new URL('${origin}');
destination.pathname = next || '/';
destination.search = location.search;
destination.hash = location.hash;
if (!route && (path === '/' || path === '')) {
  const anchors = {talks:'/learn/#workshops',workshops:'/learn/#workshops',products:'/work/#tools',plugins:'/plugins/',standards:'/work/#engineering',courses:'/learn/#experiments',games:'/work/#catalog',top:'/work/'};
  const mapped = anchors[location.hash.slice(1)];
  if (mapped) { const section = new URL(mapped, destination); destination.pathname = section.pathname; destination.hash = section.hash; }
}
document.getElementById('destination').href = destination.href;
location.replace(destination.href);
`;

async function htmlFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) result.push(path);
  }
  return result;
}

function redirect(canonical: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Contract Hero has moved</title><link rel="canonical" href="${canonical}"><noscript><meta http-equiv="refresh" content="0;url=${canonical}"></noscript><style>body{max-width:40rem;margin:15vh auto;padding:24px;background:#0b0f0c;color:#dfe6e0;font:18px/1.6 system-ui}a{color:#3df08a}</style></head><body><h1>Now at contracthero.dev</h1><p><a id="destination" href="${canonical}">Continue to Contract Hero →</a></p><script>${script}</script></body></html>\n`;
}

const manifests = [];
for (const project of projects) {
  const target = join(directory, project.repo.replace('/', '--'));
  const files = new Set(['index.html', '404.html']);
  const source = sources.find(s => s.repo === project.repo);
  if (source) {
    const published = fileURLToPath(new URL(`dist/${source.mount}/`, root));
    for (const file of await htmlFiles(published)) {
      const path = relative(published, file);
      files.add(path);
      if (!path.endsWith('index.html')) files.add(path.replace(/\.html$/, '/index.html'));
    }
  }
  if (!project.from) for (const path of ['skypies-core', 'skypies-core/desktop', 'skypies-core/ios', 'skypies-core/mockup']) files.add(path + '/index.html');
  await mkdir(target, { recursive: true });
  await writeFile(join(target, '.nojekyll'), '');
  for (const file of files) {
    let path = project.to + '/' + file.replace(/index\.html$/, '');
    if (file === '404.html') path = project.to + '/';
    if (file.startsWith('skypies-core/')) path = '/' + file.replace('skypies-core/', 'skypies/').replace(/index\.html$/, '');
    await mkdir(join(target, file, '..'), { recursive: true });
    await writeFile(join(target, file), redirect(origin + path));
  }
  manifests.push({ ...project, branch: 'codex/netlify-redirects', directory: target, files: ['.nojekyll', ...files] });
  console.log(`${project.repo}: ${files.size} redirect pages → ${origin}${project.to}/`);
}
await writeFile(join(directory, 'manifest.json'), JSON.stringify(manifests, null, 2) + '\n');
