import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GameEngine } from "../docs/src/game_engine.js";
import {
  VFX_BUDGET,
  enforceVfxBudget,
} from "../docs/src/vfx_contract.js";
import "../docs/src/vfx_phase0.js?v=vfx-phase0-1";
import {
  phase1RuntimeEvents,
  resetPhase1RuntimeForTest,
} from "../docs/src/vfx_phase1.js?v=vfx-phase1-2";
import {
  phase2RuntimeProjectiles,
  resetPhase2RuntimeForTest,
} from "../docs/src/vfx_phase2.js?v=vfx-phase2-1";
import {
  phase3RuntimeSnapshot,
  resetPhase3RuntimeForTest,
} from "../docs/src/vfx_phase3.js?v=vfx-phase3-1";
import {
  phase4RuntimeSnapshot,
  resetPhase4RuntimeForTest,
} from "../docs/src/vfx_phase4.js?v=vfx-phase4-1";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_PHASE1_EVENTS = 64;
const MAX_PHASE3_EVENTS = 24;
const MAX_PHASE4_EVENTS = 24;
const SIMULATION_STEPS = 12_000;
const SIMULATION_DELTA_SECONDS = 0.05;

function particleCount(events) {
  return (Array.isArray(events) ? events : []).reduce(
    (sum, event) => sum + Math.max(0, Math.trunc(Number(event?.particleBudget) || 0)),
    0,
  );
}

function highPowerMergeBoard() {
  return [
    512, 512, 256, 256,
    1024, 1024, 512, 512,
    2048, 2048, 1024, 1024,
    4096, 4096, 2048, 2048,
  ];
}

const burst = Array.from({ length: 1_000 }, (_, index) => ({
  id: index + 1,
  type: index % 29 === 0 ? "BOSS_KILL" : index % 7 === 0 ? "KILL" : "HIT",
  x: (index % 4 + 0.5) / 4,
  y: 0.5,
  damage: 20 + index % 80,
  targetMaxHp: 100,
  createdAtSeconds: 10 - (index % 8) * 0.03,
  strengthTier: index % 29 === 0 ? "CRITICAL" : index % 7 === 0 ? "HEAVY" : "LIGHT",
  particleBudget: 40,
}));

const feverBudgeted = enforceVfxBudget(burst, 10, VFX_BUDGET.FEVER_AMBIENT_PARTICLES);
assert.ok(feverBudgeted.length <= VFX_BUDGET.MAX_ACTIVE_EFFECTS);
assert.ok(
  particleCount(feverBudgeted) <= VFX_BUDGET.MAX_ACTIVE_PARTICLES - VFX_BUDGET.FEVER_AMBIENT_PARTICLES,
  "FEVER reserve must remain inside the global particle budget",
);
assert.equal(
  enforceVfxBudget([{ ...burst[0], createdAtSeconds: 0 }], 10, 0).length,
  0,
  "expired effects must be cleaned instead of accumulating",
);

resetPhase1RuntimeForTest();
resetPhase2RuntimeForTest();
resetPhase3RuntimeForTest();
resetPhase4RuntimeForTest();

const engine = new GameEngine(() => 0.42);
engine.state.currentHp = 1_000_000_000;
engine.state.maxHp = 1_000_000_000;

let maxVfxEvents = 0;
let maxPhase1Events = 0;
let maxPhase2Projectiles = 0;
let maxPhase3Events = 0;
let maxPhase4Events = 0;

for (let step = 0; step < SIMULATION_STEPS; step += 1) {
  if (step % 80 === 0) {
    engine.state.board = highPowerMergeBoard();
    engine.state.gameOverReason = null;
    const move = engine.move("LEFT");
    assert.equal(move.changed, true);
    assert.ok(move.mergeCount >= 4);
  }

  engine.tick(SIMULATION_DELTA_SECONDS);
  const feverActive = Number(engine.state.comboFever?.feverRemainingSeconds) > 0;
  const reserved = feverActive ? VFX_BUDGET.FEVER_AMBIENT_PARTICLES : 0;

  assert.ok(engine.state.vfxEvents.length <= VFX_BUDGET.MAX_ACTIVE_EFFECTS);
  assert.ok(
    particleCount(engine.state.vfxEvents) <= VFX_BUDGET.MAX_ACTIVE_PARTICLES - reserved,
    "runtime particles must remain inside the active budget",
  );

  maxVfxEvents = Math.max(maxVfxEvents, engine.state.vfxEvents.length);

  if (step % 25 === 0 || step === SIMULATION_STEPS - 1) {
    const phase1 = phase1RuntimeEvents();
    const phase2 = phase2RuntimeProjectiles();
    const phase3 = phase3RuntimeSnapshot();
    const phase4 = phase4RuntimeSnapshot();

    assert.ok(phase1.length <= MAX_PHASE1_EVENTS);
    assert.equal(phase2.length, engine.state.projectiles.length);
    assert.ok(phase3.events.length <= MAX_PHASE3_EVENTS);
    assert.ok(phase4.events.length <= MAX_PHASE4_EVENTS);

    maxPhase1Events = Math.max(maxPhase1Events, phase1.length);
    maxPhase2Projectiles = Math.max(maxPhase2Projectiles, phase2.length);
    maxPhase3Events = Math.max(maxPhase3Events, phase3.events.length);
    maxPhase4Events = Math.max(maxPhase4Events, phase4.events.length);
  }
}

assert.ok(maxVfxEvents > 0, "stress run must exercise combat VFX");
assert.ok(maxPhase1Events > 0, "stress run must exercise presentation VFX");
assert.ok(maxPhase2Projectiles > 0, "stress run must exercise projectile VFX");
assert.ok(maxPhase3Events > 0, "stress run must exercise boss VFX");
assert.ok(maxPhase4Events > 0, "stress run must exercise merge/FEVER VFX");
assert.ok(maxPhase2Projectiles < 512, "projectile presentation must not grow without bound");

engine.reset();
assert.equal(phase1RuntimeEvents().length, 0, "phase 1 runtime events must clear on reset");
assert.equal(phase2RuntimeProjectiles().length, 0, "phase 2 runtime projectiles must clear on reset");
assert.equal(phase3RuntimeSnapshot().events.length, 0, "phase 3 runtime events must clear on reset");
assert.equal(phase4RuntimeSnapshot().events.length, 0, "phase 4 runtime events must clear on reset");

for (const phase of [1, 2, 3, 4]) {
  const source = fs.readFileSync(path.join(ROOT, `docs/src/vfx_phase${phase}.js`), "utf8");
  assert.match(
    source,
    /Math\.min\(2, globalThis\.devicePixelRatio \|\| 1\)/,
    `phase ${phase} overlay must cap DPR at 2`,
  );
  assert.match(
    source,
    new RegExp(`getElementById\\(\"phase${phase}-vfx-overlay\"\\)`),
    `phase ${phase} must reuse its overlay canvas`,
  );
  assert.equal(
    (source.match(/createElement\(\"canvas\"\)/g) ?? []).length,
    1,
    `phase ${phase} must pool/reuse one overlay canvas instead of allocating per frame`,
  );
}

console.log(
  `VFX phase 5 performance tests passed: simulated ${(SIMULATION_STEPS * SIMULATION_DELTA_SECONDS / 60).toFixed(1)} min, `
  + `max effects=${maxVfxEvents}, phase1=${maxPhase1Events}, projectiles=${maxPhase2Projectiles}, `
  + `phase3=${maxPhase3Events}, phase4=${maxPhase4Events}`,
);
