import assert from "node:assert/strict";
import {
  PHASE2_WEAPON_PROFILES,
  PHASE2_WEAPON_TYPES,
  phase2ImpactPrimitiveCount,
  phase2WeaponProfile,
} from "../docs/src/vfx_phase2_profiles.js";

assert.deepEqual(PHASE2_WEAPON_TYPES, [
  "NORMAL",
  "RAPID",
  "MACHINE_GUN",
  "PIERCING",
  "EXPLOSIVE",
  "LASER",
]);

const normal = phase2WeaponProfile("NORMAL");
const rapid = phase2WeaponProfile("RAPID");
const machineGun = phase2WeaponProfile("MACHINE_GUN");
const piercing = phase2WeaponProfile("PIERCING");
const explosive = phase2WeaponProfile("EXPLOSIVE");
const laser = phase2WeaponProfile("LASER");

assert.equal(normal.id, "W01");
assert.equal(normal.impact.mode, "SPARK");
assert.ok(normal.projectile.trailPx <= 18, "W01 should stay a restrained baseline");

assert.equal(rapid.id, "W02");
assert.ok(rapid.projectile.widthPx < normal.projectile.widthPx, "W02 trail must read lighter than W01");
assert.ok(rapid.impact.lifeMs < normal.impact.lifeMs, "W02 impact must clear faster than W01");

assert.equal(machineGun.id, "W03");
assert.equal(machineGun.impact.mode, "DIRECTIONAL");
assert.ok(machineGun.impact.maxPrimitives <= 3, "W03 must keep particle density low at high fire rate");
assert.ok(machineGun.projectile.alpha < rapid.projectile.alpha, "W03 trail must avoid whiteout under sustained fire");

assert.equal(piercing.id, "W04");
assert.equal(piercing.impact.mode, "PIERCING");
assert.ok(piercing.impact.linePx >= 64, "W04 impact needs a readable through-line");
assert.ok(piercing.projectile.trailPx > normal.projectile.trailPx * 2, "W04 needs a longer neon afterimage than W01");

assert.equal(explosive.id, "W05");
assert.equal(explosive.impact.mode, "EXPLOSIVE");
assert.ok(explosive.impact.ringPx >= 36, "W05 blast radius must be visible");
assert.ok(explosive.impact.radialStreaks >= 8, "W05 needs radial streaks around the blast center");

assert.equal(laser.id, "W06");
assert.equal(laser.impact.mode, "LASER_ENDPOINT");
assert.ok(laser.projectile.bloomPx >= 10, "W06 needs bloom around the beam core");
assert.ok(laser.projectile.afterimages >= 3, "W06 needs a distinct beam afterimage");
assert.ok(laser.projectile.trailPx > piercing.projectile.trailPx, "W06 should read as sustained/high-energy rather than a bullet trail");

for (const weaponType of PHASE2_WEAPON_TYPES) {
  const profile = PHASE2_WEAPON_PROFILES[weaponType];
  for (const particleBudget of [0, 1, 3, 6, 10, 16]) {
    const count = phase2ImpactPrimitiveCount({ weaponType, particleBudget });
    assert.ok(count <= particleBudget, `${weaponType} must respect the event particle budget input`);
    assert.ok(count <= profile.impact.maxPrimitives, `${weaponType} must respect its own primitive cap`);
  }
}

assert.equal(phase2WeaponProfile("UNKNOWN"), null);
assert.equal(phase2ImpactPrimitiveCount({ weaponType: "UNKNOWN", particleBudget: 99 }), 0);

console.log("VFX phase 2 profile tests passed");
