# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static pages on Netlify, with a small TypeScript build that collects the public project sites.

- `site/` holds the portfolio, learning pages, case studies, and Skypies pages. `dist/` is the assembled Netlify publish directory (see `netlify.toml`); it is generated and not committed.
- `site/index.html` is the landing page: a CRT monitor on a desk that types the page as the visitor scrolls: a welcome screen, the briefing with the contact links, then five story chapters named by stage. All story copy lives in the `<article class="chapter">` blocks; the screen is their visual twin. The screen is a fixed terminal grid of 46 columns by 12 rows on every device, so each chapter must fit that box (`tools/check-viewports.mjs` fails when one does not). ASCII art goes in `<pre>` and must be plain ASCII: VT323 has no box-drawing glyphs. The briefing's last line leads into the story and the story's last line leads back to the briefing; a focus-only skip link serves keyboard users. The meta tags carry their own copy. Without JavaScript the chapters render as a plain page.
- `site/crt.js` drives the typing from the scroll position. `?show=<chapter id>` renders one chapter fully typed and static (useful for screenshots and the social card).
- `site/style.css` positions the text layer over the screen and adds the phosphor glow, scanlines and light spill. The room and the monitor are one square photo, `assets/room.jpg` (2048×2048, generated with Codex from the previous render as reference). The floppy disks and later the monitor bezel were retouched with Nano Banana Pro and pasted back through `tools/retouch-room.py`, so only those regions changed and the file is a fresh JPEG re-encode. The stage covers the viewport and is cropped around the centre of the screen; in portrait it zooms in until the screen spans 90% of the width, and in landscape at least 500px tall it never scales past the point where the whole computer (wall above the bezel to the desk edge) fits the height, so wide displays get a narrower photo whose sides fade to black. The text layer is pinned to the black screen through `--ar` (the photo's aspect ratio) and the fractions `--sx/--sy/--sw/--sh` in `style.css`. If you regenerate the photo: set `--ar`, run `python3 tools/measure-screen.py site/assets/room.jpg 45 0.47` and paste the INSET line it prints (it takes the innermost sample on each side, so a curved glass yields the rectangle inside its corners).
- `tools/` holds dev-only checks (`pnpm -C tools install` once). `node tools/check-viewports.mjs [--only ids] [--sheet out.html]` loads every chapter at 18 viewports in the installed Chrome and fails on a chapter that overflows the grid, a clipped screen, a cropped keyboard on landscape displays of 500px or more, a missing fade where the photo does not fill the viewport, type under 15px, anything the page logs or fails to load, or a behaviour check (the welcome self-types, a resize keeps the screen, the skip link and the two in-screen links land where they say, old deep-link ids resolve, reduced motion and no-JS render); `--sheet` writes a single-file contact sheet of screenshots. `tools/page.mjs` holds what the two scripts share. `node tools/social-card.mjs` recaptures `site/assets/social.jpg` (1200×630) from `index.html?show=briefing`.
- `site/resume.pdf` is the downloadable résumé, built from `profile/resume.html` with `profile/build-resume.sh`.
- `profile/profile.md` is the source of truth for every claim on the site, the résumé and LinkedIn. Change it there first.

Open TODOs are listed at the end of `profile/profile.md`.

Build and preview locally (Node 22.18+ and pnpm):

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm check
python3 -m http.server 8834 --directory dist
```

`pnpm check` crawls every published HTML page, checks local links/anchors/assets and canonical hosts, and verifies that the CRT runtime, room image, résumé, and app handoff pages survive assembly unchanged. `pnpm check:types` validates the TypeScript tools. For real Chrome navigation, desktop/mobile layout and runtime checks, install the existing tools dependencies with `pnpm -C tools install`, then run `node tools/check-portfolio.ts` against the local server (or pass a Netlify preview URL). The separate CRT regression remains `node tools/check-viewports.mjs`.

## Consolidated project sites

`portfolio-sources.json` records each public repository, immutable commit, source directory, and destination. The build downloads GitHub source archives, not GitHub Pages output. Disabling an old Pages deployment therefore cannot break this site. Archives are cached locally under `.cache/portfolio/`; a missing or unavailable source fails the build rather than publishing an empty replacement.

| Route | Source |
| --- | --- |
| `/plugins/` | `contract-hero/plugin-marketplace`, `docs/` |
| `/sui-pilot/` | `contract-hero/sui-pilot`, `site/` plus the four supporting root documents/assets |
| `/code-forge/` | `contract-hero/code-forge`, `docs/` |
| `/agentic-community-college/` | `contract-hero/agentic-community-college`, `docs/` |
| `/acc-deepbook-course/` | `contract-hero/acc-deepbook-course`, `docs/` |
| `/acc-evm-wal/` | `contract-hero/acc-evm-wal`, `docs/` |
| `/deepbook-snippets/` | `contract-hero/deepbook-snippets`, `docs/` |
| `/display-v2/` | `alilloig/display-v2-forum`, compiled `gh-pages` branch |
| `/learn/sui-dapp-testing/` | `alilloig/agentic-identity-crisis`, public guide |

To publish a source update, run `pnpm sites:refresh <id>` (for example `pnpm sites:refresh sui-pilot`), review the manifest diff, then build, check, and commit it. With no IDs, the command refreshes every source. Source repository pushes do **not** silently change the production portfolio. The Display V2 build must continue producing its compiled `gh-pages` branch even when that branch is no longer served by Pages.

Assembly rewrites owned Pages links and canonical metadata, adds a small portfolio return navigation, and adjusts the Display V2 asset base. Marketplace-specific presentation corrections are explicit in `tools/build.ts`. Upstream project code and install commands otherwise retain their original repositories. Mysten and Flow material stays upstream, with portfolio case studies linking to its source and authorship evidence.

Netlify builds `dist/` and checks it before publishing. Pull requests receive deploy previews through the existing `contracthero` Netlify project; production follows `master`. Roll back by reverting the migration commit and redeploying the previous Netlify version. Do not redirect a legacy Pages site until its independent Netlify replacement is live and checked. Legacy compatibility pages preserve paths, queries and fragments; keep their source branches available for old links.
