# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static HTML and CSS, no build step.

- `site/` is the published directory (see `netlify.toml`).
- `site/index.html` holds all the copy. Search for `TODO` to find the placeholders that still need real assets (workshop clip, program-design documents, bootcamp photos, Agent SDK course link).
- `site/resume.pdf` is the downloadable résumé.

Preview locally:

```bash
python3 -m http.server 8080 --directory site
```
