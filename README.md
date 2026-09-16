# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static HTML, CSS and one script, no build step.

- `site/` is the published directory (see `netlify.toml`).
- `site/index.html` is the landing page: a CRT monitor on a desk that types the page as the visitor scrolls: a welcome screen, the briefing with the contact links, then five story chapters named by stage. All story copy lives in the `<article class="chapter">` blocks; the screen is their visual twin. The screen is a fixed terminal grid of 46 columns by 12 rows on every device, so each chapter must fit that box (`tools/check-viewports.mjs` fails when one does not). ASCII art goes in `<pre>` and must be plain ASCII: VT323 has no box-drawing glyphs. The briefing's last line leads into the story and the story's last line leads back to the briefing; a focus-only skip link serves keyboard users. The meta tags carry their own copy. Without JavaScript the chapters render as a plain page.
- `site/crt.js` drives the typing from the scroll position. `?show=<chapter id>` renders one chapter fully typed and static (useful for screenshots and the social card).
- `site/style.css` positions the text layer over the screen and adds the phosphor glow, scanlines and light spill. The room and the monitor are one square photo, `assets/room.jpg` (2048×2048, generated with Codex from the previous render as reference; the floppy disks were later retouched with Nano Banana Pro and pasted back through `tools/retouch-room.py`, so the rest of the photo is untouched). The stage covers the viewport and is cropped around the centre of the screen; in portrait it zooms in until the screen spans 90% of the width, and in landscape it never scales past the point where the whole computer (wall above the bezel to the desk edge) fits the height, so wide displays get a narrower photo whose sides fade to black. The text layer is pinned to the black screen through `--ar` (the photo's aspect ratio) and the fractions `--sx/--sy/--sw/--sh` in `style.css`. If you regenerate the photo: set `--ar`, run `python3 tools/measure-screen.py site/assets/room.jpg 45 0.47` and paste the INSET line it prints.
- `tools/` holds dev-only checks (`pnpm -C tools install` once). `node tools/check-viewports.mjs [--sheet out.html]` loads every chapter at 17 viewports in the installed Chrome and fails on overflow, a clipped screen, a cropped keyboard on landscape displays or type under 15px; `--sheet` writes a single-file contact sheet of screenshots. `node tools/social-card.mjs` recaptures `site/assets/social.jpg` (1200×630) from `index.html?show=briefing`.
- `site/resume.pdf` is the downloadable résumé, built from `profile/resume.html` with `profile/build-resume.sh`.
- `profile/profile.md` is the source of truth for every claim on the site, the résumé and LinkedIn. Change it there first.

Open TODOs are listed at the end of `profile/profile.md`.

Preview locally (or open `site/index.html` directly; paths are relative):

```bash
python3 -m http.server 8080 --directory site
```
