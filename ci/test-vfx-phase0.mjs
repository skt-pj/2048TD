import assert from "node:assert/strict";
import "../docs/src/vfx_phase0.js";
import { GameEngine } from "../docs/src/game_engine.js";
import { VFX_BUDGET, VfxStrengthTier } from "../docs/src/vfx_contract.js";

const engine = new GameEngine(() => 0.1);
engine.state.board = new Array(16).fill(0);
engine.state.cooldowns = [999, 999, 999, 999];
engine.state.enemies = [{
  id: 7,
  enemyType: "NORMAL",
  lane: 0,
  progress: 0.5,
  speed: 0,
  hp: 100,
  maxHp: 100,
}];
engine.state.projectiles = [{
  id: 9,
  sourceColumn: 0,
  targetEnemyId: 7,
  damage: 20,
  x: 0.125,
  y: 0.5,
  speed: 1,
  weaponType: "EXPLOSIVE",
  ignoresLaneRestriction: false,
}];
engine.spawnTimer = 0;

engine.tick(0.01);
assert.equal(engine.state.vfxEvents.length, 1);
const event = engine.state.vfxEvents[0];
assert.equal(event.targetId, 7);
assert.equal(event.targetType, "NORMAL");
assert.equal(event.sourceColumn, 0);
assert.equal(event.weaponType, "EXPLOSIVE");
assert.equal(event.projectileId, 9);
assert.equal(event.contributorCount, 1);
assert.equal(event.strengthTier, VfxStrengthTier.MEDIUM);
assert.ok(event.particleBudget > 0);

const dummyEnemy = { id: 100, enemyType: "NORMAL", lane: 0, progress: 0.3, maxHp: 100 };
for (let i = 0; i < 100; i += 1) engine.pushVfxEvent(dummyEnemy, "HIT", 1);
assert.ok(engine.state.vfxEvents.length <= VFX_BUDGET.MAX_ACTIVE_EFFECTS);
assert.ok(
  engine.state.vfxEvents.reduce((sum, item) => sum + item.particleBudget, 0)
    <= VFX_BUDGET.MAX_ACTIVE_PARTICLES,
);

console.log("VFX phase 0 integration tests passed");
