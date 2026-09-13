import assert from "node:assert/strict";
import {
  enemyCountMultiplier,
  enemiesPerWave,
  enemySpawnSeconds,
  normalEnemyHpBase,
  spawnBatchSize,
} from "../docs/src/enemy_horde.js";
import { GameEngine } from "../docs/src/game_engine.js?v=fever-aura-lite-2";
import { canAttack } from "../docs/src/column_combat_rules.js";

assert.equal(enemyCountMultiplier(1), 4);
assert.equal(enemyCountMultiplier(5), 6);
assert.equal(enemyCountMultiplier(10), 10);
assert.equal(enemyCountMultiplier(15), 13);
assert.equal(enemyCountMultiplier(20), 16);
assert.equal(enemyCountMultiplier(25), 20);
assert.equal(enemyCountMultiplier(100), 20);

assert.equal(enemiesPerWave(1), 28);
assert.equal(enemiesPerWave(10), 70);
assert.equal(enemiesPerWave(25), 140);
assert.equal(spawnBatchSize(1), 2);
assert.equal(spawnBatchSize(5), 3);
assert.equal(spawnBatchSize(10), 4);
assert.equal(spawnBatchSize(15), 5);
assert.equal(spawnBatchSize(20), 6);
assert.equal(spawnBatchSize(25), 6);
assert.equal(enemySpawnSeconds(1), 0.75);
assert.equal(Number(enemySpawnSeconds(10).toFixed(3)), 0.588);
assert.equal(enemySpawnSeconds(25), 0.32);
assert.equal(normalEnemyHpBase(1), 9);
assert.equal(normalEnemyHpBase(10), 14);
assert.equal(normalEnemyHpBase(25), 21);

{
  const crossing = { enemyType: "NORMAL", lane: 0, x: 0.22, laneRadius: 0.05 };
  assert.equal(canAttack(0, crossing), true, "source lane must attack a crossing enemy");
  assert.equal(canAttack(1, crossing), true, "adjacent lane must attack an enemy whose body crosses the boundary");
  assert.equal(canAttack(2, crossing), false, "non-adjacent lane must remain blocked");
}

{
  const contained = { enemyType: "NORMAL", lane: 1, x: 0.375, laneRadius: 0.05 };
  assert.equal(canAttack(0, contained), false);
  assert.equal(canAttack(1, contained), true);
  assert.equal(canAttack(2, contained), false);
}

function countOneWave(wave) {
  let count = 0;
  const target = enemiesPerWave(wave);
  while (count < target) count += Math.min(spawnBatchSize(wave), target - count);
  return count;
}

assert.equal(countOneWave(1), 28);
assert.equal(countOneWave(10), 70);
assert.equal(countOneWave(25), 140);

{
  const engine = new GameEngine(() => 0.5);
  engine.state.board = Array(16).fill(0);
  engine.state.currentHp = 1_000_000;
  engine.state.maxHp = 1_000_000;
  engine.spawnTimer = 10;
  engine.tick(0.05);
  assert.equal(engine.state.enemies.length, 2, "wave 1 should spawn two enemies in its first horde batch");
  assert.equal(engine.state.enemies.every((enemy) => enemy.maxHp >= 9 && enemy.maxHp <= 14), true);
}

console.log("enemy horde tests passed");
