#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/build/playables}"
ZIP_PATH="${2:-$ROOT_DIR/build/2048TD-playables.zip}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$(dirname "$ZIP_PATH")"
cp -R "$ROOT_DIR/docs/." "$OUT_DIR/"

# YouTube Playables must not contain or reference the standalone browser
# leaderboard, because it depends on a third-party Cloudflare service.
rm -f \
  "$OUT_DIR/src/ranking.js" \
  "$OUT_DIR/src/ranking_transport.js"

# Use a Playables-only bootstrap with no standalone ranking code path.
cat > "$OUT_DIR/src/bootstrap.js" <<'EOF'
import "./audio.js?v=youtube-platform-1";
import "./bgm.js?v=youtube-platform-1";
import "./help.js?v=settings-help-1";
import "./main.js?v=youtube-platform-3";
EOF

# The shared game module contains a standalone-browser ranking initializer.
# Replace only that initializer in the Playables artifact so the submitted code
# has no dynamic import/reference to ranking.js at all.
python3 - "$OUT_DIR/src/main.js" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
start_marker = "async function initializeRanking(saved) {"
end_marker = "\n\nasync function initialize() {"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit("Unable to locate standalone ranking initializer")
replacement = "async function initializeRanking(_saved) {\n  hideStandaloneRankingUi();\n}"
path.write_text(text[:start] + replacement + text[end:], encoding="utf-8")
PY

# Fail closed if standalone ranking code or its third-party endpoint leaks into
# the submission artifact. YouTube can scan/analyze the submitted JavaScript.
if grep -R -n -E 'ranking_transport\.js|ranking\.js|2048td-ranking\.yukigbr3100\.workers\.dev' "$OUT_DIR"; then
  echo "Playables bundle contains standalone ranking code or endpoint references." >&2
  exit 1
fi

# The YouTube SDK must be loaded by index.html before the game bootstrap.
SDK_LINE="$(grep -n -m1 'https://www.youtube.com/game_api/v1' "$OUT_DIR/index.html" | cut -d: -f1)"
BOOTSTRAP_LINE="$(grep -n -m1 './src/bootstrap.js' "$OUT_DIR/index.html" | cut -d: -f1)"
if [[ -z "$SDK_LINE" || -z "$BOOTSTRAP_LINE" || "$SDK_LINE" -ge "$BOOTSTRAP_LINE" ]]; then
  echo "Playables SDK must load before game code." >&2
  exit 1
fi

rm -f "$ZIP_PATH"
(
  cd "$OUT_DIR"
  zip -qr "$ZIP_PATH" .
)

echo "Built $ZIP_PATH"
