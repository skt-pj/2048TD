export function isLandscapeViewport(width = globalThis.innerWidth, height = globalThis.innerHeight) {
  return Number(width) > Number(height);
}

// The landscape presentation is a 90-degree clockwise rotation of the logical
// portrait playfield. That keeps the same four logical 2048 columns attached
// to the same four combat lanes while enemies move from right to left.
export function logicalPointToScreen(x, y, landscape) {
  return landscape ? { x: 1 - y, y: x } : { x, y };
}

export function displayIndexToLogicalIndex(displayIndex, landscape, gridSize = 4) {
  if (!landscape) return displayIndex;
  const displayRow = Math.floor(displayIndex / gridSize);
  const displayCol = displayIndex % gridSize;
  const logicalRow = gridSize - 1 - displayCol;
  const logicalCol = displayRow;
  return logicalRow * gridSize + logicalCol;
}

export function screenDirectionToLogical(direction, landscape) {
  if (!landscape) return direction;
  return {
    RIGHT: "UP",
    DOWN: "RIGHT",
    LEFT: "DOWN",
    UP: "LEFT",
  }[direction] ?? direction;
}
