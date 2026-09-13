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

// A lower second score must still be registered as personal rank #2.
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

// Personal ranking keeps only the best 10 scores. Every completed game still
// increments totalGames, but a run outside the top 10 is not retained.
restorePersonalRanking(null, 0);
for (let i = 0; i < 10; i += 1) {
  const score = 1000 - i * 100;
  const result = recordPersonalResult({ score, wave: i + 1, maxTile: 2 ** (i + 1), playedAt: 4000 + i });
  assert.equal(result.rank, i + 1);
}

const outsideTop10 = recordPersonalResult({ score: 50, wave: 11, maxTile: 2048, playedAt: 5000 });
assert.equal(outsideTop10.rank, null);
let top10 = snapshotPersonalRanking();
assert.equal(top10.totalGames, 11);
assert.equal(top10.records.length, 10);
assert.deepEqual(top10.records.map((record) => record.score), [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100]);

const newSecond = recordPersonalResult({ score: 950, wave: 12, maxTile: 4096, playedAt: 6000 });
assert.equal(newSecond.rank, 2);
top10 = snapshotPersonalRanking();
assert.equal(top10.totalGames, 12);
assert.equal(top10.records.length, 10);
assert.deepEqual(top10.records.map((record) => record.score), [1000, 950, 900, 800, 700, 600, 500, 400, 300, 200]);

console.log("Personal ranking top-10 persistence tests passed");
