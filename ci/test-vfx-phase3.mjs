import assert from "node:assert/strict";
import {
  PHASE3_BOSS_PROGRESS,
  PHASE3_TIMING,
  phase3BossAnimationName,
  phase3BossDeathPrimitiveCount,
  phase3BossEventLifeMs,
  phase3BossHitPrimitiveCount,
  phase3BossSpriteAnimation,
  phase3BossSpriteFrame,
  phase3BossVisualState,
} from "../docs/src/vfx_phase3_profiles.js";

const boss = (progress, id = 1) => ({ id, enemyType: "BOSS", progress });

assert.equal(phase3BossVisualState(boss(0.02)), "IDLE");
assert.equal(phase3BossVisualState(boss(0.40)), "MOVE");
assert.equal(phase3BossVisualState(boss(0.78)), "ATTACK_PREP");
assert.equal(phase3BossVisualState(boss(0.90)), "ATTACK");
assert.equal(phase3BossVisualState({ enemyType: "NORMAL", progress: 0.9 }), "NONE");

assert.equal(phase3BossAnimationName(boss(0.02)), "idle");
assert.equal(phase3BossAnimationName(boss(0.40)), "move");
assert.equal(phase3BossAnimationName(boss(0.78)), "move", "telegraph glow starts before the attack sprite");
assert.equal(phase3BossAnimationName(boss(0.90)), "attack");
assert.equal(phase3BossAnimationName(boss(0.90), 0.12, 0.40), "hit", "hit must override attack animation");

assert.ok(PHASE3_BOSS_PROGRESS.IDLE_END < PHASE3_BOSS_PROGRESS.ATTACK_PREP);
assert.ok(PHASE3_BOSS_PROGRESS.ATTACK_PREP < PHASE3_BOSS_PROGRESS.ATTACK);
assert.ok(PHASE3_TIMING.WARNING_CONVERGE_SECONDS <= 1.25, "warning convergence should stay short and local");
assert.ok(PHASE3_TIMING.SPAWN_LIFE_MS < PHASE3_TIMING.DEATH_LIFE_MS, "boss death should out-rank spawn in lingering reward");
assert.ok(PHASE3_TIMING.HIT_LIFE_MS < PHASE3_TIMING.DEATH_LIFE_MS, "boss hit should stay below boss death");

assert.equal(phase3BossSpriteAnimation(1, "idle")?.row, 0);
assert.equal(phase3BossSpriteAnimation(1, "attack")?.row, 2);
assert.equal(phase3BossSpriteAnimation(2, "idle")?.row, 5);
assert.equal(phase3BossSpriteAnimation(2, "attack")?.row, 7);
const attackFrame = phase3BossSpriteFrame(1, "attack", 0.37);
assert.ok(attackFrame.frame >= 0 && attackFrame.frame < attackFrame.frames);

const hit = { type: "HIT", targetType: "BOSS", particleBudget: 5 };
const death = { type: "BOSS_KILL", targetType: "BOSS", particleBudget: 12 };
assert.equal(phase3BossHitPrimitiveCount(hit), 5);
assert.equal(phase3BossDeathPrimitiveCount(death), 12);
assert.equal(phase3BossHitPrimitiveCount({ ...hit, particleBudget: 99 }), 9);
assert.equal(phase3BossDeathPrimitiveCount({ ...death, particleBudget: 99 }), 18);
assert.equal(phase3BossHitPrimitiveCount({ type: "HIT", targetType: "NORMAL", particleBudget: 99 }), 0);
assert.equal(phase3BossEventLifeMs({ type: "BOSS_SPAWN" }), PHASE3_TIMING.SPAWN_LIFE_MS);
assert.equal(phase3BossEventLifeMs(hit), PHASE3_TIMING.HIT_LIFE_MS);
assert.equal(phase3BossEventLifeMs(death), PHASE3_TIMING.DEATH_LIFE_MS);

console.log("VFX phase 3 profile tests passed");
