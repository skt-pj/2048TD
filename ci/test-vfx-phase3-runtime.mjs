import assert from "node:assert/strict";
import { WeaponType } from "../docs/src/column_combat_rules.js";
import { GameEngine } from "../docs/src/game_engine.js";

await import("../docs/src/vfx_phase0.js?v=vfx-phase0-1");
const phase1 = await import("../docs/src/vfx_phase1.js?v=vfx-phase1-2");
const phase2 = await import("../docs/src/vfx_phase2.js?v=vfx-phase2-1");
const phase3 = await import("../docs/src/vfx_phase3.js?v=vfx-phase3-1");

function quietEngine() {
  const engine = new GameEngine(() => 0.1);
  engine.state.board = new Array(16).fill(0);
  engine.state.cooldowns = [999, 999, 999, 999];
  engine.state.enemies = [];
  engine.state.projectiles = [];
  engine.state.vfxEvents = [];
  engine.spawnTimer = 0;
  phase1.resetPhase1RuntimeForTest();
  phase2.resetPhase2RuntimeForTest();
  phase3.resetPhase3RuntimeForTest();
  return engine;
}

function boss(id = 11, progress = 0.50, hp = 100) {
  return {
    id,
    enemyType: "BOSS",
    lane: -1,
    progress,
    speed: 0,
    hp,
    maxHp: hp,
  };
}

function hitBoss(damage) {
  const engine = quietEngine();
  const target = boss();
  engine.state.enemies = [target];
  engine.state.projectiles = [{
    id: 70,
    sourceColumn: 1,
    targetEnemyId: target.id,
    damage,
    x: 0.5,
    y: target.progress,
    speed: 1,
    weaponType: WeaponType.NORMAL,
    ignoresLaneRestriction: false,
  }];
  engine.tick(0.01);
  return engine;
}

const warning = quietEngine();
warning.state.wave = 5;
warning.pendingBoss = true;
warning.state.bossWarning = { remainingSeconds: 0.50 };
warning.tick(0.01);
let runtime = phase3.phase3RuntimeSnapshot();
assert.ok(runtime.warningRemainingSeconds > 0 && runtime.warningRemainingSeconds < 0.50);
assert.equal(runtime.events.filter((event) => event.type === "BOSS_SPAWN").length, 0);

const spawn = quietEngine();
spawn.state.wave = 5;
spawn.pendingBoss = true;
spawn.state.bossWarning = { remainingSeconds: 0.01 };
spawn.tick(0.02);
runtime = phase3.phase3RuntimeSnapshot();
assert.equal(runtime.warningRemainingSeconds, null);
assert.equal(runtime.bosses.length, 1);
assert.equal(runtime.bosses[0].enemyType, "BOSS");
const spawnEvent = runtime.events.find((event) => event.type === "BOSS_SPAWN");
assert.ok(spawnEvent, "warning completion must create a presentation-only boss spawn event");
assert.equal(spawnEvent.targetId, runtime.bosses[0].id);
assert.equal(spawnEvent.targetType, "BOSS");
assert.ok(spawnEvent.y >= 0.055, "spawn VFX anchor should stay visible at the battlefield entry edge");
assert.ok(!JSON.stringify(spawn.serialize()).includes("BOSS_SPAWN"), "spawn presentation event must not leak into save data");

const damaged = hitBoss(20);
runtime = phase3.phase3RuntimeSnapshot();
assert.equal(damaged.state.enemies.length, 1);
assert.equal(damaged.state.enemies[0].hp, 80);
const bossHit = runtime.events.find((event) => event.type === "HIT" && event.targetType === "BOSS");
assert.ok(bossHit, "boss hit must be promoted into the phase 3 presentation runtime");
assert.equal(bossHit.damage, 20);
assert.equal(bossHit.sourceColumn, 1);
assert.equal(bossHit.weaponType, WeaponType.NORMAL);

const killed = hitBoss(120);
runtime = phase3.phase3RuntimeSnapshot();
assert.equal(killed.state.enemies.length, 0);
const bossKill = runtime.events.find((event) => event.type === "BOSS_KILL");
assert.ok(bossKill, "boss death must be retained for the longer phase 3 reward sequence");
assert.equal(bossKill.targetType, "BOSS");
assert.equal(bossKill.damage, 120);

const attacking = quietEngine();
attacking.state.enemies = [boss(18, 0.90, 200)];
attacking.tick(0.01);
runtime = phase3.phase3RuntimeSnapshot();
assert.equal(runtime.bosses.length, 1);
assert.ok(runtime.bosses[0].progress >= 0.82, "runtime must expose bosses in the attack zone to the visual layer");

console.log("VFX phase 3 runtime integration tests passed");
