export function isLandscapeViewport(width = globalThis.innerWidth, height = globalThis.innerHeight) {
  return Number(width) > Number(height);
}

// Landscape keeps the same four logical 2048 columns attached to the same four
// combat lanes. Left-hand mode places the 2048 board on the left, so combat is
// rotated clockwise and enemies move right -> left. Right-hand mode mirrors
// only the combat presentation so enemies move left -> right toward the board.
export function logicalPointToScreen(x, y, landscape, landscapeHand = "left") {
  if (!landscape) return { x, y };
  return landscapeHand === "right" ? { x: y, y: x } : { x: 1 - y, y: x };
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
