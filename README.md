# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static HTML, CSS and one script, no build step.

- `site/` is the published directory (see `netlify.toml`).
- `site/index.html` is the landing page: a CRT monitor on a desk that types the professional story as the visitor scrolls, chapter by chapter, ending with a briefing and the contact links. All copy lives in the `<article class="chapter">` blocks; the screen is their visual twin. Without JavaScript the chapters render as a plain page.
- `site/crt.js` drives the typing from the scroll position. `?show=<chapter id>` renders one chapter fully typed and static (useful for screenshots and the social card).
- `site/style.css` draws the monitor. The room and the monitor are one photo, `assets/room-wide.jpg` (landscape) or `assets/room-tall.jpg` (portrait), generated with Codex. The text layer is pinned to the black screen in photo coordinates through the `--sx/--sy/--sw/--sh` variables in `style.css`; if you regenerate a photo, re-measure with `python3 tools/measure-screen.py site/assets/room-wide.jpg` and update them.
- `site/resume.pdf` is the downloadable résumé, built from `profile/resume.html` with `profile/build-resume.sh`.
- `profile/profile.md` is the source of truth for every claim on the site, the résumé and LinkedIn. Change it there first.

Open TODOs are listed at the end of `profile/profile.md`. `assets/social.jpg` is a 1200×630 capture of `index.html?show=briefing`.

Preview locally (or open `site/index.html` directly; paths are relative):

```bash
python3 -m http.server 8080 --directory site
```
