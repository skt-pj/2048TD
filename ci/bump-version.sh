#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION_FILE="$ROOT_DIR/version.properties"

current_name="$(grep '^VERSION_NAME=' "$VERSION_FILE" | cut -d= -f2)"
current_code="$(grep '^VERSION_CODE=' "$VERSION_FILE" | cut -d= -f2)"

IFS='.' read -r major minor patch <<< "$current_name"
next_name="$major.$minor.$((patch + 1))"
next_code="$((current_code + 1))"

cat > "$VERSION_FILE" <<VERSION_EOF
VERSION_NAME=$next_name
VERSION_CODE=$next_code
VERSION_EOF

printf 'Bumped version: %s (%s) -> %s (%s)\n' "$current_name" "$current_code" "$next_name" "$next_code"
