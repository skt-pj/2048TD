export const GRID_SIZE = 4;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export function cellIndex(row, col) { return row * GRID_SIZE + col; }
export function rowOf(index) { return Math.floor(index / GRID_SIZE); }
export function colOf(index) { return index % GRID_SIZE; }

export function slideAndMergeLine(line) {
  if (line.length !== GRID_SIZE) throw new Error("line must have 4 cells");
  const compact = line.filter((value) => value !== 0);
  const merged = [];
  const createdValues = [];
  for (let i = 0; i < compact.length;) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const value = compact[i] * 2;
      merged.push(value);
      createdValues.push(value);
      i += 2;
    } else {
      merged.push(compact[i]);
      i += 1;
    }
  }
  while (merged.length < GRID_SIZE) merged.push(0);
  return { line: merged, createdValues };
}

export function moveWithoutSpawn(board, direction) {
  if (board.length !== CELL_COUNT) throw new Error("board must have 16 cells");
  const next = Array(CELL_COUNT).fill(0);
  const createdValues = [];
  let moved = false;

  for (let outer = 0; outer < GRID_SIZE; outer += 1) {
    const indices = [];
    for (let inner = 0; inner < GRID_SIZE; inner += 1) {
      if (direction === "LEFT") indices.push(cellIndex(outer, inner));
      else if (direction === "RIGHT") indices.push(cellIndex(outer, GRID_SIZE - 1 - inner));
      else if (direction === "UP") indices.push(cellIndex(inner, outer));
      else if (direction === "DOWN") indices.push(cellIndex(GRID_SIZE - 1 - inner, outer));
      else throw new Error(`unknown direction: ${direction}`);
    }
    const result = slideAndMergeLine(indices.map((index) => board[index]));
    createdValues.push(...result.createdValues);
    result.line.forEach((value, lineIndex) => {
      const index = indices[lineIndex];
      next[index] = value;
      if (value !== board[index]) moved = true;
    });
  }
  return { board: next, moved, createdValues };
}

export function spawnRandomTile(board, random = Math.random) {
  const empties = board.map((value, index) => value === 0 ? index : -1).filter((index) => index >= 0);
  if (empties.length === 0) return board.slice();
  const target = empties[Math.floor(random() * empties.length)];
  const next = board.slice();
  next[target] = random() < 0.9 ? 2 : 4;
  return next;
}

export function initialBoard(random = Math.random) {
  return spawnRandomTile(spawnRandomTile(Array(CELL_COUNT).fill(0), random), random);
}

export function canMove(board) {
  if (board.some((value) => value === 0)) return true;
  for (let index = 0; index < board.length; index += 1) {
    const row = rowOf(index);
    const col = colOf(index);
    const value = board[index];
    if (col < GRID_SIZE - 1 && board[cellIndex(row, col + 1)] === value) return true;
    if (row < GRID_SIZE - 1 && board[cellIndex(row + 1, col)] === value) return true;
  }
  return false;
}
