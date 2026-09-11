#!/bin/sh
set -eu

prefer_first() {
  for f in "$@"; do
    if [ -n "$f" ] && [ -f "$f" ]; then
      echo "$f"
      return 0
    fi
  done
  return 1
}

# Bundled proprietary fonts (optional, not in git) win over distro fallbacks.
CJK="$(prefer_first \
  "${PDF_FONT_CJK_PATH:-}" \
  /app/fonts/kaiu.ttf \
  /app/fonts/kaiu.ttc \
  /usr/share/fonts/truetype/arphic/bkai00mp.ttf \
  || true)"
LATIN="$(prefer_first \
  "${PDF_FONT_LATIN_PATH:-}" \
  /app/fonts/times.ttf \
  "/app/fonts/Times New Roman.ttf" \
  /usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf \
  /usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf \
  || true)"
LATIN_BOLD="$(prefer_first \
  "${PDF_FONT_LATIN_BOLD_PATH:-}" \
  /app/fonts/timesbd.ttf \
  /usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf \
  /usr/share/fonts/truetype/liberation2/LiberationSerif-Bold.ttf \
  || true)"

if [ -n "$CJK" ]; then export PDF_FONT_CJK_PATH="$CJK"; export PDF_FONT_PATH="$CJK"; fi
if [ -n "$LATIN" ]; then export PDF_FONT_LATIN_PATH="$LATIN"; fi
if [ -n "$LATIN_BOLD" ]; then export PDF_FONT_LATIN_BOLD_PATH="$LATIN_BOLD"; fi

echo "[hk-pdf-engine] cjk=${PDF_FONT_CJK_PATH:-missing} latin=${PDF_FONT_LATIN_PATH:-missing} port=${PDF_SERVICE_PORT:-8080}"
exec node ./service.mjs
