import assert from "node:assert/strict";
import {
  PHASE4_LIMITS,
  PHASE4_TIMING,
  phase4EventLifeMs,
  phase4FeverProfile,
  phase4FeverStage,
  phase4HighTileMilestones,
  phase4MergeDestinations,
  phase4WeaponEvolutions,
} from "../docs/src/vfx_phase4_profiles.js";

const leftBoard = [
  2, 2, 2, 2,
  4, 0, 4, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
const leftMerges = phase4MergeDestinations(leftBoard, "LEFT");
assert.deepEqual(leftMerges, [
  { logicalIndex: 0, value: 4 },
  { logicalIndex: 1, value: 4 },
  { logicalIndex: 4, value: 8 },
]);

const rightMerges = phase4MergeDestinations(leftBoard, "RIGHT");
assert.deepEqual(rightMerges, [
  { logicalIndex: 3, value: 4 },
  { logicalIndex: 2, value: 4 },
  { logicalIndex: 7, value: 8 },
]);

const verticalBoard = [
  8, 0, 0, 0,
  8, 0, 0, 0,
  16, 0, 0, 0,
  16, 0, 0, 0,
];
assert.deepEqual(phase4MergeDestinations(verticalBoard, "DOWN"), [
  { logicalIndex: 12, value: 32 },
  { logicalIndex: 8, value: 16 },
]);

const highTiles = phase4HighTileMilestones([
  { logicalIndex: 0, value: 64 },
  { logicalIndex: 1, value: 128 },
  { logicalIndex: 2, value: 256 },
]);
assert.deepEqual(highTiles, [
  { logicalIndex: 1, value: 128 },
  { logicalIndex: 2, value: 256 },
]);

const before = [
  64, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
const after = [
  128, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
assert.deepEqual(phase4WeaponEvolutions(before, after), [
  { column: 0, beforeType: "NORMAL", afterType: "RAPID" },
]);
assert.deepEqual(phase4WeaponEvolutions(after, before), [], "downgrades are not milestone rewards");

assert.equal(phase4FeverStage(0), 0);
assert.equal(phase4FeverStage(11), 1);
assert.equal(phase4FeverStage(7), 2);
assert.equal(phase4FeverStage(3), 3);
assert.ok(phase4FeverProfile(3).trailCount > phase4FeverProfile(11).trailCount);
assert.ok(phase4FeverProfile(3).speed > phase4FeverProfile(11).speed);
assert.ok(phase4FeverProfile(3).trailCount <= PHASE4_LIMITS.FEVER_TRAILS_MAX);

assert.equal(phase4EventLifeMs({ type: "MERGE" }), PHASE4_TIMING.MERGE_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "COMBO_STREAM" }), PHASE4_TIMING.COMBO_STREAM_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "FEVER_START" }), PHASE4_TIMING.FEVER_START_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "MILESTONE" }), PHASE4_TIMING.MILESTONE_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "OTHER" }), 0);

console.log("VFX phase 4 profile tests passed");
