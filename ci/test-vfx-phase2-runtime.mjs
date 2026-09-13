import assert from "node:assert/strict";
import { WeaponType } from "../docs/src/column_combat_rules.js";
import { GameEngine } from "../docs/src/game_engine.js";

await import("../docs/src/vfx_phase0.js?v=vfx-phase0-1");
const phase1 = await import("../docs/src/vfx_phase1.js?v=vfx-phase1-2");
const phase2 = await import("../docs/src/vfx_phase2.js?v=vfx-phase2-1");
const profiles = await import("../docs/src/vfx_phase2_profiles.js?v=vfx-phase2-1");

function enemy(id, progress, hp = 100) {
  return {
    id,
    enemyType: "NORMAL",
    lane: 0,
    progress,
    speed: 0,
    hp,
    maxHp: hp,
  };
}

function quietEngine() {
  const engine = new GameEngine(() => 0.1);
  engine.state.board = new Array(16).fill(0);
  engine.state.cooldowns = [999, 999, 999, 999];
  engine.state.enemies = [];
  engine.state.projectiles = [];
  engine.spawnTimer = 0;
  phase1.resetPhase1RuntimeForTest();
  phase2.resetPhase2RuntimeForTest();
  return engine;
}

function hitWithWeapon(weaponType, enemies) {
  const engine = quietEngine();
  const target = enemies[0];
  engine.state.enemies = enemies;
  engine.state.projectiles = [{
    id: 90,
    sourceColumn: 0,
    targetEnemyId: target.id,
    damage: 20,
    x: 0.125,
    y: target.progress,
    speed: 1,
    weaponType,
    ignoresLaneRestriction: false,
  }];
  engine.tick(0.01);
  return engine;
}

for (const weaponType of [WeaponType.NORMAL, WeaponType.RAPID, WeaponType.MACHINE_GUN]) {
  const engine = hitWithWeapon(weaponType, [enemy(1, 0.50)]);
  assert.equal(engine.state.vfxEvents.length, 1);
  assert.equal(engine.state.vfxEvents[0].weaponType, weaponType);
  assert.ok(profiles.phase2WeaponProfile(engine.state.vfxEvents[0].weaponType));
}

const piercing = hitWithWeapon(WeaponType.PIERCING, [enemy(1, 0.50), enemy(2, 0.56), enemy(3, 0.62)]);
assert.equal(piercing.state.vfxEvents.length, 3);
assert.ok(piercing.state.vfxEvents.every((event) => event.weaponType === WeaponType.PIERCING));

const explosive = hitWithWeapon(WeaponType.EXPLOSIVE, [enemy(1, 0.50), enemy(2, 0.56), enemy(3, 0.62)]);
assert.equal(explosive.state.vfxEvents.length, 3);
assert.ok(explosive.state.vfxEvents.every((event) => event.weaponType === WeaponType.EXPLOSIVE));

const laser = hitWithWeapon(WeaponType.LASER, [enemy(1, 0.50), enemy(2, 0.36), enemy(3, 0.68)]);
assert.equal(laser.state.vfxEvents.length, 3);
assert.ok(laser.state.vfxEvents.every((event) => event.weaponType === WeaponType.LASER));

const moving = quietEngine();
moving.state.enemies = [enemy(7, 0.20)];
moving.state.projectiles = [{
  id: 91,
  sourceColumn: 0,
  targetEnemyId: 7,
  damage: 5,
  x: 0.125,
  y: 0.90,
  speed: 0.10,
  weaponType: WeaponType.RAPID,
  ignoresLaneRestriction: false,
}];
moving.tick(0.01);
const runtime = phase2.phase2RuntimeProjectiles();
assert.equal(runtime.length, 1);
assert.equal(runtime[0].weaponType, WeaponType.RAPID);
assert.equal(runtime[0].previousX, 0.125);
assert.equal(runtime[0].previousY, 0.90);
assert.ok(runtime[0].y < 0.90, "runtime trail snapshot must follow the actual moved projectile");

console.log("VFX phase 2 runtime integration tests passed");
