import { writeFile } from 'node:fs/promises';
import { root, sources } from './sources.ts';

const ids = process.argv.slice(2);
for (const id of ids) if (!sources.some(s => s.id === id)) throw new Error(`Unknown source: ${id}`);
for (const source of sources) {
  if (ids.length && !ids.includes(source.id)) continue;
  const response = await fetch(`https://api.github.com/repos/${source.repo}/commits/${source.ref}`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  });
  if (!response.ok) throw new Error(`${source.repo}: HTTP ${response.status}; manifest unchanged`);
  const commit = await response.json() as { sha: string };
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error(`Invalid revision for ${source.repo}`);
  console.log(`${source.id}: ${source.revision.slice(0, 8)} → ${commit.sha.slice(0, 8)}`);
  source.revision = commit.sha;
}
await writeFile(new URL('portfolio-sources.json', root), JSON.stringify(sources, null, 2) + '\n');
console.log('Review the manifest diff, run pnpm build && pnpm check, and commit the update.');
