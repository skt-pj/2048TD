#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT_DIR/build/playables}"
ZIP_PATH="${2:-$ROOT_DIR/build/2048TD-playables.zip}"

node --experimental-default-type=module "$ROOT_DIR/ci/test-enemy-horde.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-fever-turret-aim.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase0.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase1.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase2.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase2-runtime.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase3.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase3-runtime.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase4.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase4-runtime.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-particles.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-vfx-phase5-performance.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-personal-ranking.mjs"
node --experimental-default-type=module "$ROOT_DIR/ci/test-layout-browser.mjs"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR" "$(dirname "$ZIP_PATH")" "$ROOT_DIR/build"
cp -R "$ROOT_DIR/docs/." "$OUT_DIR/"

# YouTube Playables must not contain or reference the standalone browser
# leaderboard, because it depends on a third-party Cloudflare service.
rm -f \
  "$OUT_DIR/src/ranking.js" \
  "$OUT_DIR/src/ranking_transport.js"

# Use a Playables-only bootstrap with no standalone ranking code path.
# Rendering/VFX modules are bundled locally, so they do not require external calls.
cat > "$OUT_DIR/src/bootstrap.js" <<'PLAYABLES_BOOTSTRAP'
import "./weapon_attack_system.js?v=weapon-attacks-1";
import "./weapon_attack_aim.js?v=weapon-attacks-web-1";
import "./vfx_phase0.js?v=vfx-phase0-2";
import "./audio.js?v=youtube-platform-1";
import "./vfx_phase1.js?v=vfx-phase1-2";
import "./vfx_phase2.js?v=vfx-phase2-2";
import "./vfx_phase3.js?v=vfx-phase3-1";
import "./vfx_phase4.js?v=vfx-phase4-1";
import "./bgm.js?v=youtube-platform-1";
import "./help.js?v=settings-help-1";
import "./board_style_setup.js?v=board-style-3";
import "./enemy_horde.js?v=weapon-attacks-web-1";
import "./vfx_particles.js?v=vfx-particles-1";
import "./main.js?v=weapon-attacks-web-1";
PLAYABLES_BOOTSTRAP

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

# Fail closed if the standalone ranking module/transport or its third-party
# endpoint leaks into the submission artifact. Match the exact module reference
# so personal_ranking.js remains allowed.
if grep -R -n -F "ranking_transport.js" "$OUT_DIR" || \
   grep -R -n -F "./ranking.js" "$OUT_DIR" || \
   grep -R -n -F "2048td-ranking.yukigbr3100.workers.dev" "$OUT_DIR"; then
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

# P5 acceptance: the VFX code/assets shipped to Playables must be byte-identical
# to Web, and both surfaces must render the same deterministic acceptance board.
node --experimental-default-type=module \
  "$ROOT_DIR/ci/verify-playables-vfx-parity.mjs" "$ROOT_DIR/docs" "$OUT_DIR"
node --experimental-default-type=module \
  "$ROOT_DIR/ci/test-vfx-phase5-browser.mjs" "$ROOT_DIR/docs/src" "$ROOT_DIR/build/vfx-phase5-web.png"
node --experimental-default-type=module \
  "$ROOT_DIR/ci/test-vfx-phase5-browser.mjs" "$OUT_DIR/src" "$ROOT_DIR/build/vfx-phase5-playables.png"
if ! cmp -s "$ROOT_DIR/build/vfx-phase5-web.png" "$ROOT_DIR/build/vfx-phase5-playables.png"; then
  echo "Web and Playables VFX acceptance captures differ." >&2
  exit 1
fi

rm -f "$ZIP_PATH"
(
  cd "$OUT_DIR"
  zip -qr "$ZIP_PATH" .
)

echo "Built $ZIP_PATH"
