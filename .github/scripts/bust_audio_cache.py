from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "docs/src/main.js",
    'import { strings } from "./i18n.js";',
    'import { strings } from "./i18n.js?v=audio-controls-2";',
)
replace_once(
    "docs/src/main.js",
    'import { LandscapeHand, normalizePreferences } from "./preferences.js";',
    'import { LandscapeHand, normalizePreferences } from "./preferences.js?v=audio-controls-2";',
)
replace_once(
    "docs/src/main.js",
    'import { setBgmPreferences } from "./bgm.js?v=audio-controls-1";',
    'import { setBgmPreferences } from "./bgm.js?v=audio-controls-2";',
)
replace_once(
    "docs/src/bootstrap.js",
    'import "./bgm.js?v=audio-controls-1";\nimport "./main.js?v=audio-controls-1";',
    'import "./bgm.js?v=audio-controls-2";\nimport "./main.js?v=audio-controls-2";',
)
replace_once(
    "docs/index.html",
    './src/bootstrap.js?v=audio-controls-1',
    './src/bootstrap.js?v=audio-controls-2',
)
