import assert from "node:assert/strict";
import { GameEngine } from "../docs/src/game_engine.js";
import { WeaponType } from "../docs/src/column_combat_rules.js";
import {
  ProjectileKind,
  circularDamageScale,
  feverRangeProfile,
  weaponAttackProfile,
} from "../docs/src/weapon_attack_profiles.js";
import {
  pendingWeaponShotsForTest,
  resetWeaponAttackRuntimeForTest,
  selectWeaponTarget,
  weaponAttackRuntimeFx,
} from "../docs/src/weapon_attack_system.js?v=weapon-attacks-1";

function enemy(id, lane, x, progress, hp = 1000) {
  return {
    id,
    enemyType: "NORMAL",
    lane,
    x,
    laneRadius: 0.05,
    progress,
    speed: 0,
    hp,
    maxHp: hp,
  };
}

function quietEngine(enemies = []) {
  const engine = new GameEngine(() => 0.5);
  engine.state.board = new Array(16).fill(0);
  engine.state.enemies = enemies;
  engine.state.projectiles = [];
  engine.state.cooldowns = [999, 999, 999, 999];
  engine.spawnTimer = -999;
  resetWeaponAttackRuntimeForTest(engine);
  return engine;
}

assert.equal(weaponAttackProfile(WeaponType.NORMAL).emitterOffsets.length, 1);
assert.equal(weaponAttackProfile(WeaponType.RAPID).emitterOffsets.length, 2);
assert.equal(weaponAttackProfile(WeaponType.MACHINE_GUN).emitterOffsets.length, 4);
assert.equal(weaponAttackProfile(WeaponType.EXPLOSIVE).kind, ProjectileKind.MISSILE);
assert.equal(weaponAttackProfile(WeaponType.LASER).kind, ProjectileKind.BEAM);
assert.ok(weaponAttackProfile(WeaponType.EXPLOSIVE).effectRadius > 0);
assert.ok(weaponAttackProfile(WeaponType.PIERCING).lineWidth > 0);
assert.equal(circularDamageScale(0.01, 0.18), 1);
assert.ok(circularDamageScale(0.12, 0.18) < 1);
assert.equal(circularDamageScale(0.30, 0.18), 0);
assert.equal(
  feverRangeProfile(WeaponType.MACHINE_GUN, true).effectRadius,
  weaponAttackProfile(WeaponType.MACHINE_GUN).effectRadius * 1.15,
);
assert.equal(
  feverRangeProfile(WeaponType.LASER, true).lineWidth,
  weaponAttackProfile(WeaponType.LASER).lineWidth * 1.20,
);

{
  const target = enemy(1, 0, 0.125, 0.50);
  const engine = quietEngine([target]);
  engine.fireProjectile(0, target, 101, WeaponType.RAPID, false);
  engine.tick(0);
  assert.equal(engine.state.projectiles.length, 2, "twin RAPID barrels must create two visible shots");
  assert.notEqual(engine.state.projectiles[0].sourceX, engine.state.projectiles[1].sourceX, "twin shots must originate from different emitters");
  assert.equal(engine.state.projectiles.reduce((sum, shot) => sum + shot.damage, 0), 101, "multi-barrel fire must preserve cycle damage");
  assert.ok(engine.state.projectiles.every((shot) => shot.visualWeaponType === WeaponType.RAPID));
}

{
  const target = enemy(2, 0, 0.125, 0.55);
  const engine = quietEngine([target]);
  engine.fireProjectile(0, target, 120, WeaponType.MACHINE_GUN, false);
  engine.tick(0);
  assert.equal(engine.state.projectiles.length, 1, "machine gun burst should start with one barrel");
  assert.equal(pendingWeaponShotsForTest(engine).length, 3, "remaining machine gun barrels must be staggered");
  engine.tick(0.05);
  assert.ok(engine.state.projectiles.length >= 2, "machine gun burst must release the next barrel on timing");
}

{
  const target = enemy(3, 0, 0.125, 0.85);
  const nearby = enemy(4, 1, 0.24, 0.85);
  const engine = quietEngine([target, nearby]);
  engine.fireProjectile(0, target, 100, WeaponType.EXPLOSIVE, false);
  engine.tick(0);
  assert.equal(engine.state.projectiles.length, 1);
  const missile = engine.state.projectiles[0];
  assert.equal(missile.projectileKind, ProjectileKind.MISSILE);
  assert.equal(missile.visualWeaponType, WeaponType.EXPLOSIVE);
  assert.ok(missile.effectRadius > 0);
  engine.tick(0.05);
  const updatedNearby = engine.state.enemies.find((item) => item.id === nearby.id);
  assert.ok(updatedNearby && updatedNearby.hp < nearby.hp, "missile AoE must damage a nearby enemy across lane boundaries");
}

{
  const target = enemy(5, 0, 0.125, 0.55);
  const behind = enemy(6, 0, 0.125, 0.35);
  const engine = quietEngine([target, behind]);
  engine.fireProjectile(0, target, 80, WeaponType.LASER, false);
  assert.equal(engine.state.projectiles.length, 0, "LASER must not create a projectile body");
  assert.equal(weaponAttackRuntimeFx().beams.length, 2, "twin laser emitters must render two beams");
  assert.ok(engine.state.enemies.find((item) => item.id === target.id).hp < target.hp);
  assert.ok(engine.state.enemies.find((item) => item.id === behind.id).hp < behind.hp, "laser line must damage enemies intersecting the beam");
}

{
  const far = enemy(7, 0, 0.125, -0.02);
  const engine = quietEngine([far]);
  assert.equal(selectWeaponTarget(engine, 0, WeaponType.MACHINE_GUN, false), null, "shorter-range weapons must respect their range envelope");
  assert.ok(selectWeaponTarget(engine, 0, WeaponType.PIERCING, false), "long-range piercing weapon should acquire the same distant enemy");
}

console.log("weapon attack system tests passed");
