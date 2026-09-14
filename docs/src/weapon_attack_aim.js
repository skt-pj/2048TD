import { GameEngine } from "./game_engine.js";
import { columnLevel, columnPower, weaponType } from "./column_combat_rules.js";
import { selectWeaponTarget } from "./weapon_attack_system.js?v=weapon-attacks-1";

const TURRET_AIM_SPEED = Math.PI * 1.5;
const TURRET_AIM_TOLERANCE = 0.02;
const normalAimRuntime = new WeakMap();

function newAimState(angle = 0) {
  return { targetEnemyId: null, angle: normalizeAngle(angle), pendingFire: false };
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(Number(angle) || 0), Math.cos(Number(angle) || 0));
}

function moveAngleTowards(current, target, maxDelta) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxDelta);
}

function aimStatesFor(engine) {
  let aims = normalAimRuntime.get(engine);
  if (!aims) {
    aims = Array.from({ length: 4 }, (_, column) => newAimState(engine.state?.turretAims?.[column]?.angle));
    normalAimRuntime.set(engine, aims);
  }
  return aims;
}

function findEnemy(engine, id) {
  if (id == null) return null;
  return engine.state.enemies.find((enemy) => enemy.id === id) ?? null;
}

function targetStillSelected(engine, column, type, ignoreLaneRestriction, target) {
  if (!target) return null;
  const selected = selectWeaponTarget(engine, column, type, ignoreLaneRestriction, target);
  return selected?.id === target.id ? target : null;
}

function advanceNormalAims(engine, deltaSeconds) {
  const delta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const aims = aimStatesFor(engine);

  for (let column = 0; column < 4; column += 1) {
    const aim = aims[column];
    const power = columnPower(engine.state.board, column);
    if (power <= 0) {
      aim.targetEnemyId = null;
      aim.pendingFire = false;
      aim.angle = moveAngleTowards(aim.angle, 0, TURRET_AIM_SPEED * delta);
      continue;
    }

    const type = weaponType(columnLevel(engine.state.board, column));
    if (engine.state.cooldowns[column] > 0 && !aim.pendingFire) {
      aim.targetEnemyId = null;
      aim.angle = moveAngleTowards(aim.angle, 0, TURRET_AIM_SPEED * delta);
      continue;
    }

    let target = targetStillSelected(engine, column, type, false, findEnemy(engine, aim.targetEnemyId));
    if (!target && engine.state.cooldowns[column] <= 0) {
      target = selectWeaponTarget(engine, column, type, false);
      aim.targetEnemyId = target?.id ?? null;
      aim.pendingFire = Boolean(target);
    }

    if (!target) {
      aim.targetEnemyId = null;
      aim.pendingFire = false;
      aim.angle = moveAngleTowards(aim.angle, 0, TURRET_AIM_SPEED * delta);
      continue;
    }

    const desiredAngle = engine.turretAimAngle(column, target);
    aim.angle = moveAngleTowards(aim.angle, desiredAngle, TURRET_AIM_SPEED * delta);
  }
}

function syncNormalAims(engine) {
  const aims = aimStatesFor(engine);
  engine.state.turretAims = aims.map((aim) => ({ ...aim }));
}

const originalFireProjectile = GameEngine.prototype.fireProjectile;
GameEngine.prototype.fireProjectile = function aimedWeaponFire(column, preferredTarget, power, type, ignoresLaneRestriction) {
  if (!ignoresLaneRestriction && this.__weaponNormalAimGate) {
    const aim = aimStatesFor(this)[column];
    let target = targetStillSelected(this, column, type, false, findEnemy(this, aim.targetEnemyId));

    if (!aim.pendingFire || !target) {
      target = selectWeaponTarget(this, column, type, false);
      aim.targetEnemyId = target?.id ?? null;
      aim.pendingFire = Boolean(target);
      return;
    }

    const desiredAngle = this.turretAimAngle(column, target);
    if (Math.abs(normalizeAngle(desiredAngle - aim.angle)) > TURRET_AIM_TOLERANCE) return;

    preferredTarget = target;
    aim.pendingFire = false;
  }

  return originalFireProjectile.call(this, column, preferredTarget, power, type, ignoresLaneRestriction);
};

GameEngine.prototype.updateFeverTurret = function weaponAwareFeverTurret(column, power, deltaSeconds) {
  const delta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const aim = this.state.turretAims[column] ?? newAimState();
  const type = weaponType(columnLevel(this.state.board, column));
  let target = targetStillSelected(this, column, type, true, findEnemy(this, aim.targetEnemyId));

  if (this.state.cooldowns[column] <= 0 && !aim.pendingFire) {
    target = selectWeaponTarget(this, column, type, true);
    aim.targetEnemyId = target?.id ?? null;
    aim.pendingFire = Boolean(target);
  } else if (aim.pendingFire && !target) {
    target = selectWeaponTarget(this, column, type, true);
    aim.targetEnemyId = target?.id ?? null;
    aim.pendingFire = Boolean(target);
  }

  if (!target) {
    aim.targetEnemyId = null;
    aim.pendingFire = false;
    aim.angle = moveAngleTowards(aim.angle, 0, TURRET_AIM_SPEED * delta);
    this.state.turretAims[column] = aim;
    return;
  }

  const desiredAngle = this.turretAimAngle(column, target);
  aim.angle = moveAngleTowards(aim.angle, desiredAngle, TURRET_AIM_SPEED * delta);
  this.state.turretAims[column] = aim;

  if (this.state.cooldowns[column] > 0 || !aim.pendingFire) return;
  if (Math.abs(normalizeAngle(desiredAngle - aim.angle)) > TURRET_AIM_TOLERANCE) return;

  this.fireProjectile(column, target, power, type, true);
  aim.pendingFire = false;
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function weaponAimTick(deltaSeconds) {
  const feverBefore = Number(this.state.comboFever?.feverRemainingSeconds) > 0;
  if (feverBefore) normalAimRuntime.delete(this);
  else advanceNormalAims(this, deltaSeconds);

  this.__weaponNormalAimGate = true;
  let result;
  try {
    result = originalTick.call(this, deltaSeconds);
  } finally {
    delete this.__weaponNormalAimGate;
  }

  if (Number(this.state.comboFever?.feverRemainingSeconds) > 0) normalAimRuntime.delete(this);
  else syncNormalAims(this);
  return result;
};

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function weaponAimReset() {
  normalAimRuntime.delete(this);
  return originalReset.call(this);
};

const originalRestore = GameEngine.prototype.restore;
GameEngine.prototype.restore = function weaponAimRestore(saved) {
  normalAimRuntime.delete(this);
  const restored = originalRestore.call(this, saved);
  if (restored && Number(this.state.comboFever?.feverRemainingSeconds) <= 0) syncNormalAims(this);
  return restored;
};

export function resetWeaponAimRuntimeForTest(engine = null) {
  if (engine) normalAimRuntime.delete(engine);
}
