import assert from "node:assert/strict";
import {
  recordPersonalResult,
  restorePersonalRanking,
  snapshotPersonalRanking,
} from "../docs/src/personal_ranking.js";

restorePersonalRanking(null, 0);

const first = recordPersonalResult({ score: 1200, wave: 4, maxTile: 128, playedAt: 1000 });
assert.equal(first.rank, 1);
assert.equal(first.isBest, true);

const second = recordPersonalResult({ score: 800, wave: 5, maxTile: 256, playedAt: 2000 });
assert.equal(second.rank, 2);
assert.equal(second.isBest, false);

const third = recordPersonalResult({ score: 1800, wave: 6, maxTile: 512, playedAt: 3000 });
assert.equal(third.rank, 1);
assert.equal(third.isBest, true);

const saved = snapshotPersonalRanking();
assert.equal(saved.totalGames, 3);
assert.equal(saved.records.length, 3);
assert.deepEqual(saved.records.map((record) => record.score), [1800, 1200, 800]);
assert.equal(saved.legacyBestScore, 1800);
assert.equal(saved.records[0].wave, 6);
assert.equal(saved.records[0].maxTile, 512);

restorePersonalRanking(saved, 1800);
const restored = snapshotPersonalRanking();
assert.deepEqual(restored.records.map((record) => record.score), [1800, 1200, 800]);
assert.equal(restored.totalGames, 3);

console.log("Personal ranking persistence tests passed");
