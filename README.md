# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static HTML, CSS and one script, no build step.

- `site/` is the published directory (see `netlify.toml`).
- `site/index.html` is the landing page: a CRT monitor on a desk that types the professional story as the visitor scrolls, chapter by chapter, ending with a briefing and the contact links. All story copy lives in the `<article class="chapter">` blocks; the screen is their visual twin. The skip link, the HUD and the meta tags carry their own copy. Without JavaScript the chapters render as a plain page.
- `site/crt.js` drives the typing from the scroll position. `?show=<chapter id>` renders one chapter fully typed and static (useful for screenshots and the social card).
- `site/style.css` positions the text layer over the screen and adds the phosphor glow, scanlines and light spill. The room and the monitor are one photo, `assets/room-wide.jpg` (landscape) or `assets/room-tall.jpg` (portrait), generated with Codex. The text layer is pinned to the black screen in photo coordinates through `--ar` (the photo's pixel aspect ratio) and `--sx/--sy/--sw/--sh` in `style.css`. If you regenerate a photo: set `--ar`, run `python3 tools/measure-screen.py site/assets/<photo>.jpg` (add `45 0.45` for the tall one) and paste the INSET line it prints. Repeat for both photos.
- `site/resume.pdf` is the downloadable résumé, built from `profile/resume.html` with `profile/build-resume.sh`.
- `profile/profile.md` is the source of truth for every claim on the site, the résumé and LinkedIn. Change it there first.

Open TODOs are listed at the end of `profile/profile.md`. `assets/social.jpg` is a 1200×630 capture of `index.html?show=briefing`.

Preview locally (or open `site/index.html` directly; paths are relative):

```bash
python3 -m http.server 8080 --directory site
```
