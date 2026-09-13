import assert from "node:assert/strict";
import { GameEngine } from "../docs/src/game_engine.js";

function emptyBoard() {
  return Array(16).fill(0);
}

function enemy(id, lane, progress = 0.4) {
  return {
    id,
    enemyType: "NORMAL",
    lane,
    progress,
    speed: 0,
    hp: 1000,
    maxHp: 1000,
  };
}

{
  const engine = new GameEngine(() => 0.5);
  const board = emptyBoard();
  board[0] = 2;
  board[3] = 2;
  engine.state.board = board;
  engine.state.enemies = [enemy(100, 3)];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 5;

  engine.tick(0.05);

  assert.equal(engine.state.turretAims[0].targetEnemyId, 100, "fever turret should acquire an all-lane target");
  assert.notEqual(engine.state.turretAims[0].angle, 0, "off-axis fever turret should start rotating toward its target");
  assert.equal(
    engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0),
    false,
    "turret must not fire before it has finished aiming",
  );
  assert.equal(
    engine.state.projectiles.some((projectile) => projectile.sourceColumn === 3),
    true,
    "already-aligned turret should fire on its own timing instead of waiting for every turret",
  );

  let columnZeroFired = false;
  for (let step = 0; step < 10 && !columnZeroFired; step += 1) {
    engine.tick(0.05);
    columnZeroFired = engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0);
  }
  assert.equal(columnZeroFired, true, "off-axis turret should fire after it reaches the target angle");
}

{
  const engine = new GameEngine(() => 0.5);
  const board = emptyBoard();
  board[0] = 2;
  engine.state.board = board;
  engine.state.enemies = [];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 5;

  for (let step = 0; step < 10; step += 1) engine.tick(0.05);

  assert.equal(engine.state.projectiles.length, 0, "fever turret must not fire without a target");
  assert.equal(engine.state.turretAims[0].pendingFire, false, "turret must stay unarmed until a target can be acquired");
}

{
  const engine = new GameEngine(() => 0.5);
  const board = emptyBoard();
  board[0] = 2;
  engine.state.board = board;
  engine.state.enemies = [enemy(200, 0)];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 0;

  engine.tick(0.01);

  assert.equal(
    engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0),
    true,
    "normal-mode firing should remain immediate and unchanged",
  );
}

console.log("fever turret aiming tests passed");
