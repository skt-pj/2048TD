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

// Old saves only had a single bestScore value. That score must be migrated into
// the same best-10 list instead of sitting above a different #1 entry.
restorePersonalRanking({
  totalGames: 5,
  legacyBestScore: 38807,
  records: [
    { runNumber: 1, score: 22664, wave: 22, maxTile: 256, playedAt: 7001 },
    { runNumber: 2, score: 16886, wave: 18, maxTile: 256, playedAt: 7002 },
    { runNumber: 3, score: 15471, wave: 17, maxTile: 256, playedAt: 7003 },
    { runNumber: 4, score: 10910, wave: 15, maxTile: 128, playedAt: 7004 },
    { runNumber: 5, score: 9000, wave: 14, maxTile: 128, playedAt: 7005 },
  ],
}, 38807);

let migrated = snapshotPersonalRanking();
assert.equal(migrated.totalGames, 6);
assert.equal(migrated.records[0].score, 38807);
assert.equal(migrated.records[0].legacy, true);
assert.deepEqual(migrated.records.slice(0, 4).map((record) => record.score), [38807, 22664, 16886, 15471]);

const migratedLowerScore = recordPersonalResult({ score: 20000, wave: 19, maxTile: 256, playedAt: 8000 });
assert.equal(migratedLowerScore.rank, 3);
assert.equal(migratedLowerScore.isBest, false);

const migratedNewBest = recordPersonalResult({ score: 50000, wave: 25, maxTile: 512, playedAt: 9000 });
assert.equal(migratedNewBest.rank, 1);
assert.equal(migratedNewBest.isBest, true);

migrated = snapshotPersonalRanking();
assert.deepEqual(migrated.records.slice(0, 4).map((record) => record.score), [50000, 38807, 22664, 20000]);
assert.equal(migrated.records[1].legacy, true);

// Restoring the migrated save must not duplicate either the current best or the
// older preserved score.
restorePersonalRanking(migrated, 50000);
const migratedRestored = snapshotPersonalRanking();
assert.deepEqual(migratedRestored.records.slice(0, 4).map((record) => record.score), [50000, 38807, 22664, 20000]);
assert.equal(migratedRestored.records.filter((record) => record.score === 50000).length, 1);
assert.equal(migratedRestored.records.filter((record) => record.score === 38807).length, 1);

// If an imported old best occupies one of the ten slots, only nine detailed
// runs remain visible so the displayed ranking is always exactly a best 10.
restorePersonalRanking({
  totalGames: 10,
  legacyBestScore: 1500,
  records: Array.from({ length: 10 }, (_, index) => ({
    runNumber: index + 1,
    score: 1000 - index * 100,
    wave: 10 - index,
    maxTile: 256,
    playedAt: 10000 + index,
  })),
}, 1500);
const legacyTop10 = snapshotPersonalRanking();
assert.equal(legacyTop10.totalGames, 11);
assert.equal(legacyTop10.records.length, 10);
assert.deepEqual(legacyTop10.records.map((record) => record.score), [1500, 1000, 900, 800, 700, 600, 500, 400, 300, 200]);

console.log("Personal ranking top-10 persistence tests passed");
