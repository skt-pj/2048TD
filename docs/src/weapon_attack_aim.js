import { GameEngine, CURRENT_RULES } from "./game_engine.js";
import { columnLevel, weaponType } from "./column_combat_rules.js";
import { selectWeaponTarget } from "./weapon_attack_system.js?v=weapon-attacks-1";

const TURRET_AIM_SPEED = Number(CURRENT_RULES?.TURRET_AIM_SPEED) || Math.PI * 1.5;
const TURRET_AIM_TOLERANCE = 0.02;

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(Number(angle) || 0), Math.cos(Number(angle) || 0));
}

function moveAngleTowards(current, target, maxDelta) {
  const delta = normalizeAngle(target - current);
  if (Math.abs(delta) <= maxDelta) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * maxDelta);
}

function targetById(engine, id) {
  if (id == null) return null;
  return engine.state.enemies.find((enemy) => enemy.id === id) ?? null;
}

function validSelectedTarget(engine, column, type, ignoreLaneRestriction, target) {
  if (!target) return null;
  const selected = selectWeaponTarget(engine, column, type, ignoreLaneRestriction, target);
  return selected?.id === target.id ? target : null;
}

GameEngine.prototype.updateTurret = function weaponAwareUpdateTurret(column, power, deltaSeconds, ignoreLaneRestriction) {
  const delta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const aim = this.state.turretAims[column] ?? { targetEnemyId: null, angle: 0, pendingFire: false };
  const type = weaponType(columnLevel(this.state.board, column));

  let target = validSelectedTarget(
    this,
    column,
    type,
    ignoreLaneRestriction,
    targetById(this, aim.targetEnemyId),
  );

  if (this.state.cooldowns[column] <= 0 && !aim.pendingFire) {
    target = selectWeaponTarget(this, column, type, ignoreLaneRestriction);
    aim.targetEnemyId = target?.id ?? null;
    aim.pendingFire = Boolean(target);
  } else if (aim.pendingFire && !target) {
    target = selectWeaponTarget(this, column, type, ignoreLaneRestriction);
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

  this.fireProjectile(column, target, power, type, ignoreLaneRestriction);
  aim.pendingFire = false;
};
