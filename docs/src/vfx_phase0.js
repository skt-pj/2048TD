import { GameEngine } from "./game_engine.js";
import { WeaponType, canAttack, selectTarget } from "./column_combat_rules.js";
import {
  VFX_BUDGET,
  VFX_EVENT_CONTRACT_VERSION,
  desiredParticleBudget,
  enforceVfxBudget,
  vfxStrengthTier,
} from "./vfx_contract.js";

function reservedAmbientParticles(engine) {
  return engine.state?.comboFever?.feverRemainingSeconds > 0
    ? VFX_BUDGET.FEVER_AMBIENT_PARTICLES
    : 0;
}

function enemyX(enemy) {
  const x = Number(enemy?.x);
  if (Number.isFinite(x)) return Math.max(0, Math.min(1, x));
  return enemy.enemyType === "BOSS" ? 0.5 : (enemy.lane + 0.5) / 4;
}

function selectProjectileTarget(projectile, enemies) {
  const ignoreLaneRestriction = Boolean(projectile.ignoresLaneRestriction);
  const existing = enemies.find(
    (enemy) => enemy.id === projectile.targetEnemyId && canAttack(projectile.sourceColumn, enemy, ignoreLaneRestriction),
  );
  if (existing || ignoreLaneRestriction) return existing ?? null;
  return selectTarget(projectile.sourceColumn, enemies, false);
}

function addContribution(map, enemy, projectile, damage) {
  if (!enemy || !projectile || damage <= 0) return;
  const contribution = {
    projectileId: Number(projectile.id) || null,
    weaponType: projectile.visualWeaponType ?? projectile.weaponType ?? null,
    sourceColumn: Number.isFinite(Number(projectile.sourceColumn)) ? Number(projectile.sourceColumn) : null,
    damage: Math.max(0, Math.trunc(Number(damage) || 0)),
    projectileKind: projectile.projectileKind ?? null,
    effectRadius: Math.max(0, Number(projectile.effectRadius) || 0),
    lineWidth: Math.max(0, Number(projectile.lineWidth) || 0),
    emitterIndex: Number.isFinite(Number(projectile.emitterIndex)) ? Number(projectile.emitterIndex) : null,
    emitterCount: Math.max(0, Math.trunc(Number(projectile.emitterCount) || 0)),
    attackSystemVersion: Number(projectile.attackSystemVersion) || null,
  };
  const current = map.get(enemy.id) ?? [];
  current.push(contribution);
  map.set(enemy.id, current);
}

function buildImpactContexts(engine, projectileCandidates, deltaSeconds) {
  const enemies = engine.state.enemies;
  const hits = [];

  for (const projectile of projectileCandidates) {
    const target = selectProjectileTarget(projectile, enemies);
    if (!target) continue;
    const dx = enemyX(target) - projectile.x;
    const dy = target.progress - projectile.y;
    const distance = Math.max(0.0001, Math.hypot(dx, dy));
    const moveDistance = projectile.speed * deltaSeconds;
    const hitRadius = target.enemyType === "BOSS" ? 0.065 : 0.035;
    if (distance <= moveDistance + hitRadius) hits.push({ projectile, target });
  }

  const contributions = new Map();
  for (const { projectile, target } of hits) {
    const ignoreLaneRestriction = Boolean(projectile.ignoresLaneRestriction);
    if ([WeaponType.NORMAL, WeaponType.RAPID, WeaponType.MACHINE_GUN].includes(projectile.weaponType)) {
      addContribution(contributions, target, projectile, projectile.damage);
    } else if (projectile.weaponType === WeaponType.PIERCING) {
      addContribution(contributions, target, projectile, projectile.damage);
      enemies
        .filter((enemy) => enemy.id !== target.id && canAttack(projectile.sourceColumn, enemy, ignoreLaneRestriction))
        .sort((a, b) => b.progress - a.progress).slice(0, 2)
        .forEach((enemy) => addContribution(contributions, enemy, projectile, Math.max(1, Math.trunc(projectile.damage * 0.70))));
    } else if (projectile.weaponType === WeaponType.EXPLOSIVE) {
      addContribution(contributions, target, projectile, projectile.damage);
      enemies
        .filter((enemy) => enemy.id !== target.id
          && canAttack(projectile.sourceColumn, enemy, ignoreLaneRestriction)
          && Math.abs(enemy.progress - target.progress) <= 0.14)
        .forEach((enemy) => addContribution(contributions, enemy, projectile, Math.max(1, Math.trunc(projectile.damage * 0.60))));
    } else if (projectile.weaponType === WeaponType.LASER) {
      enemies
        .filter((enemy) => canAttack(projectile.sourceColumn, enemy, ignoreLaneRestriction))
        .forEach((enemy) => addContribution(contributions, enemy, projectile, projectile.damage));
    }
  }

  const contexts = new Map();
  for (const [enemyId, items] of contributions) {
    const primary = items.slice().sort((a, b) => {
      const damageDiff = b.damage - a.damage;
      if (damageDiff !== 0) return damageDiff;
      return (a.projectileId ?? Number.MAX_SAFE_INTEGER) - (b.projectileId ?? Number.MAX_SAFE_INTEGER);
    })[0] ?? null;
    contexts.set(enemyId, { primary, contributorCount: items.length });
  }
  return contexts;
}

const originalPushVfxEvent = GameEngine.prototype.pushVfxEvent;
GameEngine.prototype.pushVfxEvent = function phase0PushVfxEvent(enemy, type, damage) {
  const beforeLength = this.state.vfxEvents.length;
  originalPushVfxEvent.call(this, enemy, type, damage);
  const event = this.state.vfxEvents[beforeLength];
  if (!event) return;

  let context = null;
  if (this.__weaponVfxContext) {
    context = {
      primary: this.__weaponVfxContext,
      contributorCount: Math.max(1, Math.trunc(Number(this.__weaponVfxContext.contributorCount) || 1)),
    };
  } else {
    if (!this.__vfxImpactContexts) {
      this.__vfxImpactContexts = buildImpactContexts(
        this,
        this.__vfxProjectileCandidates ?? [],
        this.__vfxDeltaSeconds ?? 0,
      );
    }
    context = this.__vfxImpactContexts.get(enemy.id) ?? null;
  }

  const primary = context?.primary ?? null;
  const strengthTier = vfxStrengthTier(type, damage, enemy.maxHp);
  Object.assign(event, {
    contractVersion: VFX_EVENT_CONTRACT_VERSION,
    targetId: enemy.id,
    targetType: enemy.enemyType ?? null,
    targetMaxHp: Math.max(0, Number(enemy.maxHp) || 0),
    sourceColumn: primary?.sourceColumn ?? null,
    weaponType: primary?.weaponType ?? null,
    projectileId: primary?.projectileId ?? null,
    contributorCount: context?.contributorCount ?? 0,
    projectileKind: primary?.projectileKind ?? null,
    effectRadius: Math.max(0, Number(primary?.effectRadius) || 0),
    lineWidth: Math.max(0, Number(primary?.lineWidth) || 0),
    emitterIndex: Number.isFinite(Number(primary?.emitterIndex)) ? Number(primary.emitterIndex) : null,
    emitterCount: Math.max(0, Math.trunc(Number(primary?.emitterCount) || 0)),
    attackSystemVersion: Number(primary?.attackSystemVersion) || null,
    strengthTier,
    particleBudget: desiredParticleBudget(strengthTier, this.state.vfxEvents.length),
  });

  this.state.vfxEvents = enforceVfxBudget(
    this.state.vfxEvents,
    this.state.elapsedSeconds,
    reservedAmbientParticles(this),
  );
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase0Tick(deltaSeconds) {
  if (this.state.gameOverReason) return originalTick.call(this, deltaSeconds);

  const delta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const projectileArray = this.state.projectiles;
  const originalPush = projectileArray.push;
  const candidates = projectileArray.map((projectile) => ({ ...projectile }));
  projectileArray.push = function captureProjectile(...items) {
    for (const item of items) candidates.push({ ...item });
    return originalPush.apply(this, items);
  };

  this.__vfxProjectileCandidates = candidates;
  this.__vfxDeltaSeconds = delta;
  this.__vfxImpactContexts = null;

  try {
    const result = originalTick.call(this, deltaSeconds);
    this.state.vfxEvents = enforceVfxBudget(
      this.state.vfxEvents,
      this.state.elapsedSeconds,
      reservedAmbientParticles(this),
    );
    return result;
  } finally {
    if (this.state.projectiles === projectileArray && projectileArray.push !== originalPush) {
      projectileArray.push = originalPush;
    }
    delete this.__vfxProjectileCandidates;
    delete this.__vfxDeltaSeconds;
    delete this.__vfxImpactContexts;
  }
};

const originalRestore = GameEngine.prototype.restore;
GameEngine.prototype.restore = function phase0Restore(saved) {
  const restored = originalRestore.call(this, saved);
  if (!restored) return false;
  this.state.vfxEvents = enforceVfxBudget(
    this.state.vfxEvents,
    this.state.elapsedSeconds,
    reservedAmbientParticles(this),
  );
  this.vfxEventId = Math.max(0, ...this.state.vfxEvents.map((event) => Number(event.id) || 0)) + 1;
  return true;
};
