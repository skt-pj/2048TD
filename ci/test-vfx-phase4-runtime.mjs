import assert from "node:assert/strict";
import { GameEngine } from "../docs/src/game_engine.js";
import {
  phase4RuntimeSnapshot,
  resetPhase4RuntimeForTest,
} from "../docs/src/vfx_phase4.js";

const engine = new GameEngine(() => 0.5);
engine.state.board = [
  64, 64, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
  0, 0, 0, 0,
];
engine.state.score = 0;
engine.state.comboFever.feverGaugeTiles = 27;
engine.state.comboFever.feverRemainingSeconds = 0;
engine.state.comboFever.feverCount = 0;
engine.state.comboFever.comboEventId = 0;
resetPhase4RuntimeForTest();

const result = engine.move("LEFT");
assert.equal(result.changed, true);
assert.equal(result.mergeCount, 1);
assert.deepEqual(result.createdValues, [128]);
assert.equal(engine.state.score, 128, "phase 4 presentation must not change score rules");
assert.equal(engine.state.board[0], 128, "the merged tile must remain the normal 2048 result");
assert.equal(engine.state.comboFever.feverCount, 1);
assert.equal(engine.state.comboFever.feverRemainingSeconds, 11);

const snapshot = phase4RuntimeSnapshot();
assert.equal(snapshot.feverRemainingSeconds, 11);
assert.ok(snapshot.events.length <= 24);

const merge = snapshot.events.find((event) => event.type === "MERGE");
assert.ok(merge);
assert.equal(merge.logicalIndex, 0);
assert.equal(merge.value, 128);

const combo = snapshot.events.find((event) => event.type === "COMBO_STREAM");
assert.ok(combo);
assert.deepEqual(combo.logicalIndices, [0]);
assert.equal(combo.combo, 1);

const fever = snapshot.events.find((event) => event.type === "FEVER_START");
assert.ok(fever, "reaching 29 processed tiles must create one FEVER start event");
assert.equal(fever.feverCount, 1);

const milestone = snapshot.events.find((event) => event.type === "MILESTONE");
assert.ok(milestone);
assert.deepEqual(milestone.highTiles, [{ logicalIndex: 0, value: 128 }]);
assert.ok(milestone.evolutions.some((event) => event.column === 0 && event.beforeType === "NORMAL" && event.afterType === "RAPID"));

engine.tick(0.05);
const afterTick = phase4RuntimeSnapshot();
assert.ok(afterTick.feverRemainingSeconds < 11 && afterTick.feverRemainingSeconds > 0);

console.log("VFX phase 4 runtime tests passed");
