import assert from "node:assert/strict";
import "../docs/src/enemy_horde.js";
import { GameEngine } from "../docs/src/game_engine.js?v=turret-aim-aura-1";

function emptyBoard() {
  return Array(16).fill(0);
}

function enemy(id, lane, progress = 0.4, x = null, laneRadius = 0.05) {
  const value = {
    id,
    enemyType: "NORMAL",
    lane,
    progress,
    speed: 0,
    hp: 1000,
    maxHp: 1000,
  };
  if (Number.isFinite(x)) {
    value.x = x;
    value.laneRadius = laneRadius;
  }
  return value;
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
  engine.state.enemies = [enemy(200, 0, 0.4, 0.235)];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 0;

  engine.tick(0.016);

  assert.equal(engine.state.turretAims[0].targetEnemyId, 200, "normal turret should acquire its attackable horde target");
  assert.notEqual(engine.state.turretAims[0].angle, 0, "normal turret should rotate toward an off-center enemy");
  assert.equal(
    engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0),
    false,
    "normal turret must wait until it is aimed before firing",
  );

  let fired = false;
  for (let step = 0; step < 10 && !fired; step += 1) {
    engine.tick(0.016);
    fired = engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0);
  }
  assert.equal(fired, true, "normal turret should fire after finishing its rotation");
  assert.equal(
    engine.state.projectiles.find((projectile) => projectile.sourceColumn === 0)?.ignoresLaneRestriction,
    false,
    "normal-mode aiming must preserve normal lane restrictions",
  );
}

{
  const engine = new GameEngine(() => 0.5);
  const board = emptyBoard();
  board[0] = 2;
  engine.state.board = board;
  engine.state.enemies = [enemy(300, 3)];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 0;

  engine.tick(0.05);

  assert.equal(engine.state.turretAims[0].targetEnemyId, null, "normal turret must not acquire a non-attackable lane");
  assert.equal(engine.state.projectiles.length, 0, "normal turret must not fire across unrelated lanes");
}

{
  const engine = new GameEngine(() => 0.5);
  const board = emptyBoard();
  board[0] = 2;
  engine.state.board = board;
  engine.state.enemies = [enemy(400, 3)];
  engine.state.projectiles = [];
  engine.state.cooldowns = [0, 0, 0, 0];
  engine.state.comboFever.feverRemainingSeconds = 5;

  engine.tick(0.05);
  assert.equal(engine.state.turretAims[0].targetEnemyId, 400, "fever should allow a cross-lane aim target");

  engine.state.comboFever.feverRemainingSeconds = 0;
  engine.tick(0.05);

  assert.equal(engine.state.turretAims[0].targetEnemyId, null, "ending fever must drop a cross-lane aim target");
  assert.equal(engine.state.turretAims[0].pendingFire, false, "ending fever must clear a cross-lane pending shot");
  assert.equal(
    engine.state.projectiles.some((projectile) => projectile.sourceColumn === 0 && !projectile.ignoresLaneRestriction),
    false,
    "a fever target must not leak into a new normal-mode shot",
  );
}

console.log("turret aiming tests passed");
