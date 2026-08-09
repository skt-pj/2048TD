#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="$ROOT_DIR/ci/2048td-release.jks.b64"
TARGET_FILE="$ROOT_DIR/ci/2048td-release.jks"

base64 --decode "$SOURCE_FILE" > "$TARGET_FILE"
chmod 600 "$TARGET_FILE"

echo "Restored stable signing key: $TARGET_FILE"
