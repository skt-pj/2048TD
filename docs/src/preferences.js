export const LandscapeHand = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

function normalizeVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1;
  return Math.max(0, Math.min(1, number));
}

export function normalizePreferences(raw) {
  return {
    landscapeHand: raw?.landscapeHand === LandscapeHand.RIGHT
      ? LandscapeHand.RIGHT
      : LandscapeHand.LEFT,
    sfxEnabled: raw?.sfxEnabled !== false,
    sfxVolume: normalizeVolume(raw?.sfxVolume),
  };
}

export function isRightHandLandscape(preferences, landscape) {
  return Boolean(landscape) && normalizePreferences(preferences).landscapeHand === LandscapeHand.RIGHT;
}
