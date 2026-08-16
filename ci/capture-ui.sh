#!/usr/bin/env bash
set -euo pipefail

PACKAGE="com.sktpj.td2048"
ACTIVITY="com.sktpj.td2048/.MainActivity"
OUT_DIR="${1:-ui-captures}"
APK="${2:-app/build/outputs/apk/debug/app-debug.apk}"

mkdir -p "$OUT_DIR"

capture() {
  local name="$1"
  adb exec-out screencap -p > "$OUT_DIR/$name.png"
}

dump_failure() {
  echo "=== UI CAPTURE DIAGNOSTICS ===" >&2
  if [[ -f "$OUT_DIR/window.xml" ]]; then
    cat "$OUT_DIR/window.xml" >&2 || true
  fi
  echo "=== LOGCAT ===" >&2
  adb logcat -d -t 250 >&2 || true
}
trap dump_failure ERR

tap_text() {
  local target="$1"
  adb shell uiautomator dump --compressed /sdcard/window.xml >/dev/null
  adb pull /sdcard/window.xml "$OUT_DIR/window.xml" >/dev/null
  local coordinates
  coordinates="$(python3 - "$OUT_DIR/window.xml" "$target" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

path, target = sys.argv[1], sys.argv[2]
root = ET.parse(path).getroot()
for node in root.iter("node"):
    text = node.attrib.get("text", "")
    desc = node.attrib.get("content-desc", "")
    if target == text or target == desc or target in text or target in desc:
        match = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            print((x1 + x2) // 2, (y1 + y2) // 2)
            raise SystemExit(0)
raise SystemExit(2)
PY
)"
  read -r x y <<< "$coordinates"
  adb shell input tap "$x" "$y"
  sleep 1
}

adb install -r "$APK" >/dev/null
adb shell am force-stop "$PACKAGE"
adb shell am start -n "$ACTIVITY" >/dev/null
sleep 5

# First-frame capture can race with the initial Compose draw on a cold emulator.
# Enter/leave pause once so the actual game UI is definitely rendered before the acceptance screenshot.
tap_text "Ⅱ"
tap_text "再開"
sleep 1
capture "01-main-game"

tap_text "Ⅱ"
capture "02-pause-settings"

tap_text "戦闘終了 / メニューへ"
capture "03-home"

tap_text "編成"
capture "04-formation"

tap_text "‹"
capture "05-home-return"

tap_text "キャラ"
capture "06-characters"

tap_text "‹"
capture "07-home-return"

tap_text "ガチャ"
capture "08-gacha"

tap_text "‹"
tap_text "RANKING"
sleep 2
capture "09-ranking"

rm -f "$OUT_DIR/window.xml"
