#!/usr/bin/env bash
# Render profile/resume.html to profile/resume.pdf, assert it is still one page, and copy it to site/.
# Needs the installed Google Chrome and tools/node_modules (pnpm install in tools/). The A4 page size comes
# from @page in resume.html; without that rule Chrome falls back to Letter.
set -euo pipefail
cd "$(dirname "$0")"
[ -d ../tools/node_modules/playwright-core ] || { echo "run 'pnpm install' in tools/ first" >&2; exit 1; }

# Render to a temp file so a failed render never overwrites the last good PDF.
tmp="$(mktemp -t resume).pdf"
# Playwright drives the installed Google Chrome and waits for the web fonts before printing (see
# tools/render-resume.mjs); Chrome's own --print-to-pdf prints on `load`, before the fonts arrive.
node ../tools/render-resume.mjs "$tmp"
[ -s "$tmp" ] || { echo "Chrome wrote no PDF" >&2; exit 1; }

# Count /Page objects (the [^s] excludes /Pages) and stop if the résumé no longer fits one page.
python3 - "$tmp" <<'PY'
import re, sys
d = open(sys.argv[1], 'rb').read()
n = len(re.findall(rb'/Type\s*/Page[^s]', d))
if n != 1:
    raise SystemExit(f"resume.pdf has {n} pages; it must be exactly 1. Trim profile/resume.html and rebuild.")
print("pages: 1")
PY

mv "$tmp" resume.pdf
cp resume.pdf ../site/resume.pdf   # the served copy
