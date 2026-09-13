import assert from "node:assert/strict";
import { GameEngine } from "../docs/src/game_engine.js";

await import("../docs/src/vfx_phase0.js?v=vfx-phase0-1");
const phase1 = await import("../docs/src/vfx_phase1.js?v=vfx-phase1-2");
const phase2 = await import("../docs/src/vfx_phase2.js?v=vfx-phase2-1");
const phase3 = await import("../docs/src/vfx_phase3.js?v=vfx-phase3-1");
const phase4 = await import("../docs/src/vfx_phase4.js?v=vfx-phase4-1");

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
  phase4.resetPhase4RuntimeForTest();
  return engine;
}

const merge = quietEngine();
merge.state.board = [
  2, 2, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
const mergeResult = merge.move("LEFT");
let runtime = phase4.phase4RuntimeSnapshot();
assert.equal(mergeResult.mergeCount, 1);
assert.equal(merge.state.mergeBurst, 4);
assert.equal(merge.state.mergePeak, 4);
const mergeEvent = runtime.events.find((event) => event.type === "MERGE");
assert.ok(mergeEvent, "merge must create a presentation event");
assert.equal(mergeEvent.logicalIndex, 0);
assert.equal(mergeEvent.value, 4);
assert.equal(mergeEvent.mergeBurst, 4);
assert.equal(mergeEvent.mergePeak, 4);
const comboLink = runtime.events.find((event) => event.type === "COMBO_LINK");
assert.ok(comboLink, "the same merge event must feed the COMBO HUD connector");
assert.equal(comboLink.comboEventId, merge.state.comboFever.comboEventId);
assert.equal(comboLink.logicalIndex, mergeEvent.logicalIndex);
assert.ok(!JSON.stringify(merge.serialize()).includes('"type":"MERGE"'), "phase 4 merge presentation events must not enter save data");
assert.ok(!JSON.stringify(merge.serialize()).includes('"type":"COMBO_LINK"'), "combo connector events must remain presentation-only");

const fever = quietEngine();
fever.state.board = [
  2, 2, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
fever.state.comboFever.feverGaugeTiles = 27;
fever.move("LEFT");
runtime = phase4.phase4RuntimeSnapshot();
const feverStart = runtime.events.find((event) => event.type === "FEVER_START");
assert.ok(feverStart, "crossing the fever target must create the lane shockwave event");
assert.equal(fever.state.comboFever.feverCount, 1);
assert.equal(runtime.feverActive, true);
assert.ok(runtime.feverRemainingSeconds > 0);
assert.ok(!JSON.stringify(fever.serialize()).includes("FEVER_START"), "fever start VFX must remain presentation-only");
fever.tick(0.05);
runtime = phase4.phase4RuntimeSnapshot();
assert.equal(runtime.feverActive, true);
assert.ok(runtime.feverRemainingSeconds < 11, "active fever presentation must follow the live fever timer");

const milestone = quietEngine();
milestone.state.board = [
  64, 64, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
milestone.move("LEFT");
runtime = phase4.phase4RuntimeSnapshot();
const tileMilestone = runtime.events.find((event) => event.type === "TILE_MILESTONE");
assert.ok(tileMilestone, "creating a 128+ tile must create the growth reward event");
assert.equal(tileMilestone.value, 128);
assert.equal(tileMilestone.logicalIndex, 0);

const evolution = quietEngine();
evolution.state.board = [
  0, 64, 0, 0,
  0, 2, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
evolution.move("LEFT");
runtime = phase4.phase4RuntimeSnapshot();
const weaponEvolution = runtime.events.find((event) => event.type === "WEAPON_EVOLUTION" && event.column === 0);
assert.ok(weaponEvolution, "a weapon threshold increase must create one short evolution reward");
assert.equal(weaponEvolution.fromType, "NORMAL");
assert.equal(weaponEvolution.toType, "RAPID");
assert.equal(runtime.events.some((event) => event.type === "WEAPON_EVOLUTION" && event.column === 1), false, "weapon downgrades must not use the reward channel");
assert.ok(!JSON.stringify(evolution.serialize()).includes("WEAPON_EVOLUTION"), "weapon evolution VFX must remain presentation-only");

console.log("VFX phase 4 runtime integration tests passed");
