#!/usr/bin/env bash
# Render profile/resume.html to profile/resume.pdf, assert it is still one page, and copy it to site/.
# macOS only by default: override CHROME=<path> for another install. The A4 page size comes from
# @page in resume.html, not from a flag here; without that rule Chrome falls back to Letter.
set -euo pipefail
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME; set CHROME=<path>" >&2; exit 1; }

# Render to a temp file so a failed render never overwrites the last good PDF. Chrome's stderr stays
# visible: it is the only channel that explains a failure. A throwaway profile avoids the lock held by
# a normal Chrome that is already open.
tmp="$(mktemp -t resume).pdf"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --user-data-dir="$(mktemp -d)" \
  --print-to-pdf="$tmp" "file://$PWD/resume.html"
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
