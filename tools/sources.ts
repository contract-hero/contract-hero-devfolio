import { readFile } from 'node:fs/promises';

export interface Source {
  id: string;
  repo: string;
  ref: string;
  revision: string;
  directory: string;
  mount: string;
  extras?: string[];
}

export const root = new URL('../', import.meta.url);
export const origin = 'https://contracthero.dev';
export const sources: Source[] = JSON.parse(await readFile(new URL('portfolio-sources.json', root), 'utf8'));

// Longest first: the organization root must not swallow project URLs.
export const legacyRoutes = [
  ...sources.map(s => ({
    from: `https://${s.repo.split('/')[0]}.github.io/${s.repo.split('/')[1]}`,
    to: `/${s.mount}`,
  })),
  { from: 'https://contract-hero.github.io/skypies-core', to: '/skypies' },
  { from: 'https://contract-hero.github.io/contract-hero-devfolio', to: '' },
  { from: 'https://alilloig.github.io/artifacts', to: '/work' },
  { from: 'https://contract-hero.github.io', to: '/work' },
].sort((a, b) => b.from.length - a.from.length);

export function migrateURLs(text: string): string {
  for (const { from, to } of legacyRoutes) {
    // Match URL boundaries, not repository names that happen to share a prefix.
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`${escaped}(?=[/"'\\s#?<>\\x60]|$)`, 'g'), to);
  }
  return text;
}
