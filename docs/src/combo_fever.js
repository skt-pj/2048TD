export const FEVER_TARGET_TILES = 29;
export const FEVER_DURATION_SECONDS = 11;

export function processedTilesForMergeCount(mergeCount) {
  return Math.max(0, Math.trunc(Number(mergeCount) || 0)) * 2;
}

export function newComboFeverState() {
  return {
    combo: 0,
    comboEventId: 0,
    feverGaugeTiles: 0,
    feverRemainingSeconds: 0,
    feverCount: 0,
  };
}

export function feverActive(state) {
  return Number(state?.feverRemainingSeconds) > 0;
}

export function feverGaugeRatio(state) {
  if (feverActive(state)) {
    return Math.max(0, Math.min(1, Number(state.feverRemainingSeconds) / FEVER_DURATION_SECONDS));
  }
  return Math.max(0, Math.min(1, Number(state?.feverGaugeTiles || 0) / FEVER_TARGET_TILES));
}

export function registerMerges(state, mergeCount) {
  const count = Math.max(0, Math.trunc(Number(mergeCount) || 0));
  if (count <= 0) return state;
  state.combo = count;
  state.comboEventId += 1;
  if (feverActive(state)) return state;
  state.feverGaugeTiles = Math.min(
    FEVER_TARGET_TILES,
    state.feverGaugeTiles + processedTilesForMergeCount(count),
  );
  if (state.feverGaugeTiles >= FEVER_TARGET_TILES) {
    state.feverRemainingSeconds = FEVER_DURATION_SECONDS;
    state.feverCount += 1;
  }
  return state;
}

export function tickFever(state, deltaSeconds) {
  const delta = Math.max(0, Number(deltaSeconds) || 0);
  if (delta <= 0 || !feverActive(state)) return state;
  state.feverRemainingSeconds = Math.max(0, state.feverRemainingSeconds - delta);
  if (state.feverRemainingSeconds <= 0) state.feverGaugeTiles = 0;
  return state;
}
