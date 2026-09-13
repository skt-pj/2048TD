export const LandscapeHand = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

export const BoardStyle = Object.freeze({
  CLASSIC: "classic",
  MODERN: "modern",
  SF: "sf",
});

const AUDIO_DEFAULTS_VERSION = 2;

function normalizeVolume(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function normalizeBoardStyle(value) {
  if (value === BoardStyle.MODERN) return BoardStyle.MODERN;
  if (value === BoardStyle.SF) return BoardStyle.SF;
  return BoardStyle.CLASSIC;
}

export function normalizePreferences(raw) {
  const legacySfxVolume = Number(raw?.sfxVolume);
  const migrateLegacySfxDefault = raw?.audioDefaultsVersion !== AUDIO_DEFAULTS_VERSION
    && legacySfxVolume === 1;

  return {
    landscapeHand: raw?.landscapeHand === LandscapeHand.RIGHT
      ? LandscapeHand.RIGHT
      : LandscapeHand.LEFT,
    boardStyle: normalizeBoardStyle(raw?.boardStyle),
    sfxEnabled: raw?.sfxEnabled !== false,
    sfxVolume: migrateLegacySfxDefault ? 0.30 : normalizeVolume(raw?.sfxVolume, 0.30),
    bgmEnabled: raw?.bgmEnabled !== false,
    bgmVolume: normalizeVolume(raw?.bgmVolume, 1),
    audioDefaultsVersion: AUDIO_DEFAULTS_VERSION,
  };
}

export function isRightHandLandscape(preferences, landscape) {
  return Boolean(landscape) && normalizePreferences(preferences).landscapeHand === LandscapeHand.RIGHT;
}
