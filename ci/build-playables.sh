#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/build/playables}"
ZIP_PATH="${2:-$ROOT_DIR/build/2048TD-playables.zip}"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$(dirname "$ZIP_PATH")"
cp -R "$ROOT_DIR/docs/." "$OUT_DIR/"

# Standalone browser ranking uses a third-party Cloudflare service and must never
# be included in the YouTube Playables submission bundle.
rm -f \
  "$OUT_DIR/src/ranking.js" \
  "$OUT_DIR/src/ranking_transport.js"

# Fail closed if the prohibited standalone ranking endpoint leaks into the bundle.
if grep -R -n -F "2048td-ranking.yukigbr3100.workers.dev" "$OUT_DIR"; then
  echo "Playables bundle contains the standalone ranking endpoint." >&2
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
