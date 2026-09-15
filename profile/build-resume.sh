#!/usr/bin/env bash
# Render profile/resume.html to profile/resume.pdf with headless Chrome (A4, no header/footer).
set -euo pipefail
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$PWD/resume.pdf" "file://$PWD/resume.html" 2>/dev/null
python3 -c "import re;d=open('resume.pdf','rb').read();n=len(re.findall(rb'/Type\\s*/Page[^s]',d));print('pages:',n);raise SystemExit(0 if n==1 else 1)"
