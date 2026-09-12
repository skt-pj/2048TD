from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected block not found in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


main = "docs/src/main.js"
replace_once(
    main,
    'import { setSfxPreferences } from "./audio.js";\n',
    'import { setSfxPreferences } from "./audio.js";\nimport { setBgmPreferences } from "./bgm.js?v=audio-controls-1";\n',
)
replace_once(
    main,
    '  $("sound-effects-title").textContent = text.soundEffects;\n  $("sound-effects-description").textContent = text.soundEffectsDescription;\n  $("sound-effects-volume-label").textContent = text.soundEffectsVolume;\n  $("settings-restart").textContent = text.restartGame;\n',
    '  $("sound-effects-title").textContent = text.soundEffects;\n  $("sound-effects-description").textContent = text.soundEffectsDescription;\n  $("sound-effects-volume-label").textContent = text.soundEffectsVolume;\n  $("background-music-title").textContent = text.backgroundMusic;\n  $("background-music-description").textContent = text.backgroundMusicDescription;\n  $("background-music-volume-label").textContent = text.backgroundMusicVolume;\n  $("settings-restart").textContent = text.restartGame;\n',
)
replace_once(
    main,
    '  $("sound-effects-volume-value").textContent = `${volume}%`;\n  setSfxPreferences(preferences);\n}\n',
    '  $("sound-effects-volume-value").textContent = `${volume}%`;\n  setSfxPreferences(preferences);\n\n  const bgmToggle = $("background-music-toggle");\n  const bgmVolume = Math.round(preferences.bgmVolume * 100);\n  bgmToggle.setAttribute("aria-checked", String(preferences.bgmEnabled));\n  $("background-music-toggle-label").textContent = preferences.bgmEnabled ? text.backgroundMusicOn : text.backgroundMusicOff;\n  $("background-music-volume").value = String(bgmVolume);\n  $("background-music-volume").setAttribute("aria-valuenow", String(bgmVolume));\n  $("background-music-volume-value").textContent = `${bgmVolume}%`;\n  setBgmPreferences(preferences);\n}\n',
)
replace_once(
    main,
    'function setSoundEffectsVolume(percent, persist) {\n  preferences = normalizePreferences({ ...preferences, sfxVolume: Number(percent) / 100 });\n  updatePreferenceUi();\n  if (persist) saveProgress();\n}\n\nfunction openSettings() {\n',
    'function setSoundEffectsVolume(percent, persist) {\n  preferences = normalizePreferences({ ...preferences, sfxVolume: Number(percent) / 100 });\n  updatePreferenceUi();\n  if (persist) saveProgress();\n}\n\nfunction setBackgroundMusicEnabled(enabled) {\n  preferences = normalizePreferences({ ...preferences, bgmEnabled: enabled });\n  updatePreferenceUi();\n  saveProgress();\n}\n\nfunction setBackgroundMusicVolume(percent, persist) {\n  preferences = normalizePreferences({ ...preferences, bgmVolume: Number(percent) / 100 });\n  updatePreferenceUi();\n  if (persist) saveProgress();\n}\n\nfunction openSettings() {\n',
)
replace_once(
    main,
    '  $("sound-effects-toggle").addEventListener("click", () => setSoundEffectsEnabled(!preferences.sfxEnabled));\n  $("sound-effects-volume").addEventListener("input", (event) => setSoundEffectsVolume(event.currentTarget.value, false));\n  $("sound-effects-volume").addEventListener("change", (event) => setSoundEffectsVolume(event.currentTarget.value, true));\n  $("play-again").addEventListener("click", newGame);\n',
    '  $("sound-effects-toggle").addEventListener("click", () => setSoundEffectsEnabled(!preferences.sfxEnabled));\n  $("sound-effects-volume").addEventListener("input", (event) => setSoundEffectsVolume(event.currentTarget.value, false));\n  $("sound-effects-volume").addEventListener("change", (event) => setSoundEffectsVolume(event.currentTarget.value, true));\n  $("background-music-toggle").addEventListener("click", () => setBackgroundMusicEnabled(!preferences.bgmEnabled));\n  $("background-music-volume").addEventListener("input", (event) => setBackgroundMusicVolume(event.currentTarget.value, false));\n  $("background-music-volume").addEventListener("change", (event) => setBackgroundMusicVolume(event.currentTarget.value, true));\n  $("play-again").addEventListener("click", newGame);\n',
)

index = "docs/index.html"
replace_once(
    index,
    '<output id="sound-effects-volume-value" for="sound-effects-volume">100%</output>',
    '<output id="sound-effects-volume-value" for="sound-effects-volume">30%</output>',
)
replace_once(
    index,
    '<input id="sound-effects-volume" class="sound-volume" type="range" min="0" max="100" step="1" value="100" aria-labelledby="sound-effects-volume-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">',
    '<input id="sound-effects-volume" class="sound-volume" type="range" min="0" max="100" step="1" value="30" aria-labelledby="sound-effects-volume-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow="30">',
)
bgm_block = '''        <div class="settings-section settings-audio-section">
          <div class="settings-section-title-row audio-title-row">
            <div>
              <h3 id="background-music-title">Background music</h3>
              <p id="background-music-description">Enable or disable background music.</p>
            </div>
            <button id="background-music-toggle" class="sound-toggle" type="button" role="switch" aria-checked="true" aria-labelledby="background-music-title background-music-toggle-label">
              <span class="sound-toggle-track" aria-hidden="true"><span class="sound-toggle-thumb"></span></span>
              <span id="background-music-toggle-label" class="sound-toggle-label">ON</span>
            </button>
          </div>

          <div class="sound-volume-row">
            <label id="background-music-volume-label" for="background-music-volume">Volume</label>
            <output id="background-music-volume-value" for="background-music-volume">100%</output>
          </div>
          <input id="background-music-volume" class="sound-volume" type="range" min="0" max="100" step="1" value="100" aria-labelledby="background-music-volume-label" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
        </div>

'''
marker = '        <div class="settings-actions">\n'
p = Path(index)
text = p.read_text()
if 'id="background-music-toggle"' in text:
    raise SystemExit("BGM settings already exist")
if marker not in text:
    raise SystemExit("settings actions marker not found")
p.write_text(text.replace(marker, bgm_block + marker, 1))
replace_once(
    index,
    '<script type="module" src="./src/bootstrap.js?v=web-ranking-1"></script>',
    '<script type="module" src="./src/bootstrap.js?v=audio-controls-1"></script>',
)

replace_once(
    "docs/src/bootstrap.js",
    'import "./bgm.js?v=bgm-loop-fix-2";\nimport "./main.js?v=web-ranking-1";\n',
    'import "./bgm.js?v=audio-controls-1";\nimport "./main.js?v=audio-controls-1";\n',
)
