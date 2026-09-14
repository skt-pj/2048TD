import assert from "node:assert/strict";
import { WeaponType } from "../docs/src/column_combat_rules.js";
import { GameEngine } from "../docs/src/game_engine.js";

const particleVfx = await import("../docs/src/vfx_particles.js?v=vfx-particles-1");

function enemy(id, progress) {
  return {
    id,
    enemyType: "NORMAL",
    lane: 0,
    x: 0.125,
    progress,
    speed: 0,
    hp: 100,
    maxHp: 100,
  };
}

const engine = new GameEngine(() => 0.1);
engine.state.board = new Array(16).fill(0);
engine.state.cooldowns = [999, 999, 999, 999];
engine.state.enemies = [enemy(1, 0.20)];
engine.state.projectiles = [{
  id: 501,
  sourceColumn: 0,
  targetEnemyId: 1,
  damage: 5,
  x: 0.125,
  y: 0.90,
  speed: 0.10,
  weaponType: WeaponType.EXPLOSIVE,
  visualWeaponType: WeaponType.EXPLOSIVE,
  projectileKind: "MISSILE",
  ignoresLaneRestriction: false,
}];
engine.spawnTimer = 0;
particleVfx.resetParticleVfxForTest();

engine.tick(0.016);
const trailStats = particleVfx.particleVfxStats();
assert.ok(trailStats.activeParticles > 0, "missile movement must emit particles");
assert.equal(trailStats.trackedProjectiles, 1);
assert.ok(trailStats.activeParticles <= trailStats.maxParticles);

engine.state.vfxEvents.push({
  type: "HIT",
  weaponType: WeaponType.EXPLOSIVE,
  projectileId: 501,
  targetId: 1,
  x: 0.125,
  y: 0.50,
  createdAtSeconds: engine.state.elapsedSeconds,
  damage: 25,
  particleBudget: 28,
  effectRadius: 0.12,
});
engine.tick(0.016);
const impactStats = particleVfx.particleVfxStats();
assert.ok(impactStats.activeParticles > trailStats.activeParticles, "impact must add a particle burst");
assert.ok(impactStats.seenImpactEvents >= 1);
assert.ok(impactStats.activeParticles <= impactStats.maxParticles);

for (let i = 0; i < 80; i += 1) {
  engine.state.vfxEvents.push({
    type: "BOSS_KILL",
    weaponType: WeaponType.LASER,
    projectileId: 700 + i,
    targetId: 800 + i,
    x: 0.5,
    y: 0.4,
    createdAtSeconds: engine.state.elapsedSeconds + i / 10000,
    damage: 100,
    particleBudget: 52,
  });
}
engine.tick(0.016);
const cappedStats = particleVfx.particleVfxStats();
assert.ok(cappedStats.activeParticles <= cappedStats.maxParticles, "particle pool must stay bounded");

console.log("Particle VFX runtime tests passed");
