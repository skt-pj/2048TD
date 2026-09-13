import assert from "node:assert/strict";
import {
  PHASE4_LIMITS,
  PHASE4_TIMING,
  phase4EventLifeMs,
  phase4FeverActiveProfile,
  phase4IsHighTileMilestone,
  phase4IsWeaponEvolution,
  phase4MergeTiles,
  phase4WeaponRank,
} from "../docs/src/vfx_phase4_profiles.js";

const board = (...values) => values.concat(new Array(16 - values.length).fill(0));

assert.deepEqual(
  phase4MergeTiles(board(2, 2, 0, 0), "LEFT").map(({ logicalIndex, value }) => ({ logicalIndex, value })),
  [{ logicalIndex: 0, value: 4 }],
);
assert.deepEqual(
  phase4MergeTiles(board(0, 0, 2, 2), "RIGHT").map(({ logicalIndex, value }) => ({ logicalIndex, value })),
  [{ logicalIndex: 3, value: 4 }],
);
const upBoard = new Array(16).fill(0);
upBoard[0] = 4;
upBoard[4] = 4;
assert.deepEqual(
  phase4MergeTiles(upBoard, "UP").map(({ logicalIndex, value }) => ({ logicalIndex, value })),
  [{ logicalIndex: 0, value: 8 }],
);
const downBoard = new Array(16).fill(0);
downBoard[8] = 8;
downBoard[12] = 8;
assert.deepEqual(
  phase4MergeTiles(downBoard, "DOWN").map(({ logicalIndex, value }) => ({ logicalIndex, value })),
  [{ logicalIndex: 12, value: 16 }],
);
assert.deepEqual(
  phase4MergeTiles(board(2, 2, 2, 2), "LEFT").map(({ logicalIndex, value }) => ({ logicalIndex, value })),
  [{ logicalIndex: 0, value: 4 }, { logicalIndex: 1, value: 4 }],
  "merge anchors must match the post-slide destination cells",
);

assert.equal(phase4IsHighTileMilestone(64), false);
assert.equal(phase4IsHighTileMilestone(128), true);
assert.equal(phase4IsHighTileMilestone(256), true);
assert.equal(phase4IsHighTileMilestone(192), false);

assert.equal(phase4WeaponRank("NORMAL"), 0);
assert.equal(phase4WeaponRank("LASER"), 5);
assert.equal(phase4IsWeaponEvolution("NORMAL", "RAPID"), true);
assert.equal(phase4IsWeaponEvolution("PIERCING", "LASER"), true);
assert.equal(phase4IsWeaponEvolution("LASER", "EXPLOSIVE"), false);
assert.equal(phase4IsWeaponEvolution("RAPID", "RAPID"), false);

const feverIntro = phase4FeverActiveProfile(11, 0);
const feverSustain = phase4FeverActiveProfile(11, PHASE4_TIMING.FEVER_START_BOOST_MS + 1);
const feverTail = phase4FeverActiveProfile(1, PHASE4_TIMING.FEVER_START_BOOST_MS + 1);
assert.equal(feverIntro.active, true);
assert.equal(feverIntro.streakCount, PHASE4_LIMITS.FEVER_START_STREAKS);
assert.ok(feverIntro.streakCount > feverSustain.streakCount, "fever entry must visibly amplify trail density");
assert.ok(feverIntro.speed > feverSustain.speed, "fever entry must visibly amplify trail speed");
assert.ok(feverSustain.streakCount <= PHASE4_LIMITS.FEVER_ACTIVE_STREAKS, "sustained fever must stay within the readability budget");
assert.ok(feverSustain.streakCount >= feverTail.streakCount, "fever trails may gently decay with remaining fever time");
assert.deepEqual(phase4FeverActiveProfile(0, 0), { active: false, streakCount: 0, speed: 0, alpha: 0 });

assert.equal(phase4EventLifeMs({ type: "MERGE" }), PHASE4_TIMING.MERGE_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "COMBO_LINK" }), PHASE4_TIMING.COMBO_LINK_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "FEVER_START" }), PHASE4_TIMING.FEVER_START_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "TILE_MILESTONE" }), PHASE4_TIMING.MILESTONE_LIFE_MS);
assert.equal(phase4EventLifeMs({ type: "WEAPON_EVOLUTION" }), PHASE4_TIMING.EVOLUTION_LIFE_MS);
assert.ok(PHASE4_TIMING.MERGE_LIFE_MS < PHASE4_TIMING.MILESTONE_LIFE_MS, "growth milestones should out-rank routine merges");

console.log("VFX phase 4 profile tests passed");
