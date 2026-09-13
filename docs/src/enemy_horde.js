import { GameEngine } from "./game_engine.js?v=turret-aim-aura-1";
import { GRID_SIZE } from "./game_rules.js";

const BASE_ENEMIES_PER_WAVE = 7;
const BASE_INITIAL_ENEMY_HP = 24;
const BOSS_HP_RATIO = 12;
const BOSS_EVERY_WAVES = 5;
const BOSS_WARNING_SECONDS = 5;
const ENEMY_LANE_JITTER = 0.11;
const ENEMY_LANE_RADIUS = 0.05;

export function enemyCountMultiplier(wave) {
  const normalizedWave = Math.max(1, Math.trunc(Number(wave) || 1));
  return Math.min(20, 4 + Math.floor((normalizedWave - 1) * 16 / 24));
}

export function enemiesPerWave(wave) {
  return BASE_ENEMIES_PER_WAVE * enemyCountMultiplier(wave);
}

export function spawnBatchSize(wave) {
  const normalizedWave = Math.max(1, Math.trunc(Number(wave) || 1));
  return Math.min(6, 2 + Math.floor(normalizedWave / 5));
}

export function enemySpawnSeconds(wave) {
  const normalizedWave = Math.max(1, Math.trunc(Number(wave) || 1));
  return Math.max(0.32, 0.75 - (normalizedWave - 1) * 0.018);
}

export function normalEnemyHpBase(wave) {
  const normalizedWave = Math.max(1, Math.trunc(Number(wave) || 1));
  return 9 + Math.floor(normalizedWave / 2);
}

function originalSpawnSeconds(wave) {
  return Math.max(0.48, 1.30 - (wave - 1) * 0.045);
}

function clampLaneX(lane, offset) {
  const center = (lane + 0.5) / GRID_SIZE;
  return Math.max(0.02, Math.min(0.98, center + offset));
}

const originalReset = GameEngine.prototype.reset;
const originalRestore = GameEngine.prototype.restore;
const originalSerialize = GameEngine.prototype.serialize;
const originalTick = GameEngine.prototype.tick;
const originalEnemyX = GameEngine.prototype.enemyX;

GameEngine.prototype.reset = function resetWithHorde() {
  const result = originalReset.call(this);
  this.hordeEnemiesSpawnedThisWave = 0;
  return result;
};

GameEngine.prototype.restore = function restoreWithHorde(saved) {
  const restored = originalRestore.call(this, saved);
  if (!restored) return false;
  const target = enemiesPerWave(this.state.wave);
  this.hordeEnemiesSpawnedThisWave = Math.max(
    0,
    Math.min(target - 1, Math.trunc(Number(saved?.hordeEnemiesSpawnedThisWave) || 0)),
  );
  this.enemiesSpawnedThisWave = 0;
  return true;
};

GameEngine.prototype.serialize = function serializeWithHorde() {
  return {
    ...originalSerialize.call(this),
    enemiesSpawnedThisWave: 0,
    hordeEnemiesSpawnedThisWave: Math.max(0, Math.trunc(Number(this.hordeEnemiesSpawnedThisWave) || 0)),
  };
};

GameEngine.prototype.createNormalEnemy = function createHordeEnemy(id, wave) {
  const lane = Math.floor(this.random() * GRID_SIZE);
  const offset = (this.random() * 2 - 1) * ENEMY_LANE_JITTER;
  const maxHp = normalEnemyHpBase(wave) + Math.floor(this.random() * 6);
  return {
    id,
    enemyType: "NORMAL",
    lane,
    x: clampLaneX(lane, offset),
    laneRadius: ENEMY_LANE_RADIUS,
    progress: -0.05,
    speed: 0.075 + this.random() * 0.035 + wave * 0.003,
    hp: maxHp,
    maxHp,
  };
};

GameEngine.prototype.enemyX = function hordeEnemyX(enemy) {
  if (enemy?.enemyType !== "BOSS") {
    const x = Number(enemy?.x);
    if (Number.isFinite(x)) return Math.max(0, Math.min(1, x));
  }
  return originalEnemyX.call(this, enemy);
};

GameEngine.prototype.tick = function tickWithHorde(deltaSeconds) {
  if (this.state.gameOverReason) return originalTick.call(this, deltaSeconds);

  const wave = Math.max(1, Math.trunc(Number(this.state.wave) || 1));
  const delta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const desiredInterval = enemySpawnSeconds(wave);
  const baseInterval = originalSpawnSeconds(wave);

  this.enemiesSpawnedThisWave = 0;
  if (desiredInterval < baseInterval) {
    this.spawnTimer += delta * (baseInterval / desiredInterval - 1);
  }

  const result = originalTick.call(this, deltaSeconds);
  const spawnedBatch = this.enemiesSpawnedThisWave > 0;
  this.enemiesSpawnedThisWave = 0;
  if (!spawnedBatch || this.state.gameOverReason) return result;

  const targetCount = enemiesPerWave(wave);
  const alreadySpawned = Math.max(0, Math.trunc(Number(this.hordeEnemiesSpawnedThisWave) || 0));
  const batchCount = Math.min(spawnBatchSize(wave), Math.max(0, targetCount - alreadySpawned));

  for (let i = 1; i < batchCount; i += 1) {
    this.state.enemies.push(this.createNormalEnemy(this.enemyId++, wave));
  }

  const nextSpawned = alreadySpawned + batchCount;
  if (nextSpawned < targetCount) {
    this.hordeEnemiesSpawnedThisWave = nextSpawned;
    return result;
  }

  this.hordeEnemiesSpawnedThisWave = 0;
  this.state.wave = wave + 1;
  result.waveChanged = true;
  if (this.state.wave % BOSS_EVERY_WAVES === 0 && this.lastBossWave !== this.state.wave) {
    this.pendingBoss = true;
    this.state.bossWarning = { remainingSeconds: BOSS_WARNING_SECONDS };
  }
  return result;
};

export const HORDE_RULES = Object.freeze({
  BASE_ENEMIES_PER_WAVE,
  MIN_MULTIPLIER: 4,
  MAX_MULTIPLIER: 20,
  ENEMY_LANE_JITTER,
  ENEMY_LANE_RADIUS,
  BOSS_HP_FORMULA: (wave) => (BASE_INITIAL_ENEMY_HP + wave * 7) * BOSS_HP_RATIO,
});
