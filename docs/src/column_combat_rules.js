import { GRID_SIZE, CELL_COUNT, cellIndex } from "./game_rules.js";

export const WeaponType = Object.freeze({
  NORMAL: "NORMAL",
  RAPID: "RAPID",
  MACHINE_GUN: "MACHINE_GUN",
  PIERCING: "PIERCING",
  EXPLOSIVE: "EXPLOSIVE",
  LASER: "LASER",
});

export function tileLevel(tileValue) {
  if (tileValue < 2) return 0;
  let value = tileValue;
  let level = 0;
  while (value > 1) {
    value = Math.floor(value / 2);
    level += 1;
  }
  return level;
}

export function columnPower(board, column) {
  if (column < 0 || column >= GRID_SIZE || board.length !== CELL_COUNT) throw new Error("invalid column or board");
  let sum = 0;
  for (let row = 0; row < GRID_SIZE; row += 1) sum += board[cellIndex(row, column)];
  return sum;
}

export function columnLevel(board, column) {
  if (column < 0 || column >= GRID_SIZE || board.length !== CELL_COUNT) throw new Error("invalid column or board");
  let sum = 0;
  for (let row = 0; row < GRID_SIZE; row += 1) sum += tileLevel(board[cellIndex(row, column)]);
  return sum;
}

export function weaponType(level) {
  if (level >= 31) return WeaponType.LASER;
  if (level >= 25) return WeaponType.EXPLOSIVE;
  if (level >= 19) return WeaponType.PIERCING;
  if (level >= 13) return WeaponType.MACHINE_GUN;
  if (level >= 7) return WeaponType.RAPID;
  return WeaponType.NORMAL;
}

export function fireIntervalSeconds(type) {
  return {
    NORMAL: 0.90, RAPID: 0.62, MACHINE_GUN: 0.24,
    PIERCING: 0.72, EXPLOSIVE: 0.95, LASER: 0.78,
  }[type];
}

export function projectileSpeed(type) {
  return {
    NORMAL: 1.45, RAPID: 1.70, MACHINE_GUN: 2.20,
    PIERCING: 1.85, EXPLOSIVE: 1.35, LASER: 4.00,
  }[type];
}

export function canAttack(column, enemy, ignoreLaneRestriction = false) {
  if (ignoreLaneRestriction) return true;
  return enemy.enemyType === "BOSS" ? (column === 1 || column === 2) : enemy.lane === column;
}

export function remainingTime(enemy) {
  return Math.max(0, 1 - enemy.progress) / Math.max(0.0001, enemy.speed);
}

export function selectTarget(column, enemies, ignoreLaneRestriction = false) {
  return enemies.filter((enemy) => canAttack(column, enemy, ignoreLaneRestriction)).sort((a, b) => {
    const timeDiff = remainingTime(a) - remainingTime(b);
    if (Math.abs(timeDiff) > 1e-9) return timeDiff;
    if (a.enemyType !== b.enemyType) return a.enemyType === "BOSS" ? -1 : 1;
    return a.id - b.id;
  })[0] ?? null;
}
