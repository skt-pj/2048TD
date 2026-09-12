import assert from "node:assert/strict";
import "../docs/src/vfx_phase0.js";
import {
  PHASE1_TIMING,
  phase1ReactionProfile,
  phase1RecoilOffset,
  phase1RuntimeEvents,
  phase1ShakeOffset,
  phase1VisualAgeMs,
  resetPhase1RuntimeForTest,
} from "../docs/src/vfx_phase1.js";
import { GameEngine } from "../docs/src/game_engine.js";

function quietEngine() {
  const engine = new GameEngine(() => 0.1);
  engine.state.board = new Array(16).fill(0);
  engine.state.cooldowns = [999, 999, 999, 999];
  engine.state.enemies = [];
  engine.state.projectiles = [];
  engine.spawnTimer = 0;
  resetPhase1RuntimeForTest();
  return engine;
}

const hitEngine = quietEngine();
hitEngine.state.enemies = [{
  id: 7,
  enemyType: "NORMAL",
  lane: 0,
  progress: 0.5,
  speed: 0,
  hp: 100,
  maxHp: 100,
}];
hitEngine.state.projectiles = [{
  id: 9,
  sourceColumn: 0,
  targetEnemyId: 7,
  damage: 20,
  x: 0.125,
  y: 0.5,
  speed: 1,
  weaponType: "NORMAL",
  ignoresLaneRestriction: false,
}];
hitEngine.tick(0.01);
assert.equal(hitEngine.state.enemies[0].hp, 80);
assert.equal(hitEngine.state.vfxEvents[0].type, "HIT");
const hitPresentation = phase1RuntimeEvents().find((event) => event.type === "HIT");
assert.ok(hitPresentation);
assert.equal(hitPresentation.sourceColumn, 0);
assert.equal(hitPresentation.targetId, 7);
assert.equal(PHASE1_TIMING.IMPACT_HOLD_MS, 60);
assert.ok(PHASE1_TIMING.IMPACT_HOLD_MS >= 40 && PHASE1_TIMING.IMPACT_HOLD_MS <= 80);
assert.equal(
  phase1VisualAgeMs(hitPresentation, hitPresentation.observedAtMs + PHASE1_TIMING.IMPACT_HOLD_MS - 1),
  0,
);
assert.equal(
  phase1VisualAgeMs(hitPresentation, hitPresentation.observedAtMs + PHASE1_TIMING.IMPACT_HOLD_MS + 20),
  20,
);
assert.ok(phase1RecoilOffset([hitPresentation], 0, hitPresentation.observedAtMs + 20) > 0);
const hitShake = phase1ShakeOffset([hitPresentation], hitPresentation.observedAtMs + 20);
assert.ok(Math.hypot(hitShake.x, hitShake.y) > 0);

const killEngine = quietEngine();
killEngine.state.enemies = [{
  id: 8,
  enemyType: "NORMAL",
  lane: 1,
  progress: 0.45,
  speed: 0,
  hp: 10,
  maxHp: 10,
}];
killEngine.state.projectiles = [{
  id: 10,
  sourceColumn: 1,
  targetEnemyId: 8,
  damage: 20,
  x: 0.375,
  y: 0.45,
  speed: 1,
  weaponType: "NORMAL",
  ignoresLaneRestriction: false,
}];
killEngine.tick(0.01);
assert.equal(killEngine.state.enemies.length, 0);
assert.equal(killEngine.state.vfxEvents[0].type, "KILL");
const killPresentation = phase1RuntimeEvents().find((event) => event.type === "KILL");
assert.ok(killPresentation);
assert.ok(phase1ReactionProfile("KILL").shakePx > phase1ReactionProfile("HIT").shakePx);
assert.ok(phase1ReactionProfile("KILL").lifeMs > phase1ReactionProfile("HIT").lifeMs);

const leakEngine = quietEngine();
const hpBeforeLeak = leakEngine.state.currentHp;
leakEngine.state.enemies = [{
  id: 11,
  enemyType: "NORMAL",
  lane: 2,
  progress: 0.999,
  speed: 0.10,
  hp: 23,
  maxHp: 23,
}];
leakEngine.tick(0.05);
assert.equal(leakEngine.state.currentHp, hpBeforeLeak - 23);
assert.equal(leakEngine.state.enemies.length, 0);
assert.equal(leakEngine.state.vfxEvents.length, 0, "base damage feedback must not enter saved combat VFX state");
const baseDamage = phase1RuntimeEvents().find((event) => event.type === "BASE_DAMAGE");
assert.ok(baseDamage);
assert.equal(baseDamage.damage, 23);
assert.equal(baseDamage.targetType, "BASE");
assert.equal(baseDamage.contributorCount, 1);
assert.ok(Math.abs(baseDamage.x - 0.625) < 1e-9);
const baseShake = phase1ShakeOffset([baseDamage], baseDamage.observedAtMs + 20);
assert.ok(Math.hypot(baseShake.x, baseShake.y) > 0);
assert.ok(phase1ReactionProfile("BASE_DAMAGE").shakePx > phase1ReactionProfile("HIT").shakePx);

console.log("VFX phase 1 integration tests passed");
