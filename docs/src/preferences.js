export const LandscapeHand = Object.freeze({
  LEFT: "left",
  RIGHT: "right",
});

export function normalizePreferences(raw) {
  return {
    landscapeHand: raw?.landscapeHand === LandscapeHand.RIGHT
      ? LandscapeHand.RIGHT
      : LandscapeHand.LEFT,
  };
}

export function isRightHandLandscape(preferences, landscape) {
  return Boolean(landscape) && normalizePreferences(preferences).landscapeHand === LandscapeHand.RIGHT;
}
