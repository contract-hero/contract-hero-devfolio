# contracthero.dev

Personal site of Álvaro Lillo Igualada. Static HTML and CSS, no build step.

- `site/` is the published directory (see `netlify.toml`).
- `site/index.html` holds all the copy. Search for `TODO` to find the six placeholders: social card, Agent SDK course links, workshop clip, bootcamp photos, program-design documents, and the footer availability line. Three of them also render as visible boxes on the page.
- `site/resume.pdf` is the downloadable résumé.

Preview locally:

```bash
python3 -m http.server 8080 --directory site
```
