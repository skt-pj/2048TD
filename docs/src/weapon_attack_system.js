import { GameEngine } from "./game_engine.js?v=fever-turret-aim-2";
import {
  WeaponType,
  canAttack,
  fireIntervalSeconds,
  projectileSpeed,
  remainingTime,
  selectTarget,
} from "./column_combat_rules.js";
import {
  ProjectileKind,
  circularDamageScale,
  emitterOrigin,
  enemyPoint,
  feverRangeProfile,
  lineDamageScale,
  logicalDistance,
  pointSegmentDistance,
  splitCycleDamage,
  weaponAttackProfile,
} from "./weapon_attack_profiles.js";

const ATTACK_SYSTEM_VERSION = 1;
const MUZZLE_LIFE_SECONDS = 0.11;
const BEAM_LIFE_SECONDS = 0.14;
const IMPACT_LIFE_SECONDS = 0.52;
const pendingShots = new WeakMap();
let runtimeElapsedSeconds = 0;
let runtimeFxId = 1;
let runtimeBeams = [];
let runtimeMuzzles = [];
let runtimeProjectiles = [];
let runtimeImpacts = [];

function clampDelta(deltaSeconds) {
  return Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
}

function turretPoint(engine, column) {
  return engine.turretPosition(column);
}

function enemyRadius(enemy) {
  if (enemy?.enemyType === "BOSS") return 0.055;
  return Math.max(0.012, Number(enemy?.laneRadius) || 0.018);
}

function inRange(source, enemy, range) {
  return logicalDistance(source, enemyPoint(enemy)) <= range + enemyRadius(enemy);
}

function attackableEnemies(engine, column, type, ignoreLaneRestriction) {
  const source = turretPoint(engine, column);
  const profile = feverRangeProfile(type, ignoreLaneRestriction);
  return engine.state.enemies.filter(
    (enemy) => canAttack(column, enemy, ignoreLaneRestriction) && inRange(source, enemy, profile.range),
  );
}

function densityScore(enemies, center, radius) {
  let score = 0;
  for (const enemy of enemies) {
    const distance = logicalDistance(enemyPoint(enemy), center);
    if (distance > radius + enemyRadius(enemy)) continue;
    const hpWeight = Math.min(2, Math.max(0.25, Number(enemy.hp) / Math.max(1, Number(enemy.maxHp) || 1)));
    score += hpWeight;
  }
  return score;
}

function lineScore(enemies, source, target, width) {
  let score = 0;
  for (const enemy of enemies) {
    const hit = pointSegmentDistance(enemyPoint(enemy), source, target);
    if (hit.distance > width * 0.5 + enemyRadius(enemy)) continue;
    score += enemy.enemyType === "BOSS" ? 2 : 1;
  }
  return score;
}

export function selectWeaponTarget(engine, column, type, ignoreLaneRestriction = false, preferredTarget = null) {
  const source = turretPoint(engine, column);
  const profile = feverRangeProfile(type, ignoreLaneRestriction);
  const candidates = attackableEnemies(engine, column, type, ignoreLaneRestriction);
  if (!candidates.length) return null;

  if (ignoreLaneRestriction && preferredTarget && candidates.some((enemy) => enemy.id === preferredTarget.id)) {
    return candidates.find((enemy) => enemy.id === preferredTarget.id) ?? null;
  }

  if (profile.targetMode === "CLUSTER" || profile.targetMode === "SCATTER") {
    return candidates.slice().sort((a, b) => {
      const scoreDiff = densityScore(engine.state.enemies, enemyPoint(b), profile.effectRadius)
        - densityScore(engine.state.enemies, enemyPoint(a), profile.effectRadius);
      if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
      return remainingTime(a) - remainingTime(b);
    })[0];
  }

  if (profile.targetMode === "LINE") {
    return candidates.slice().sort((a, b) => {
      const scoreDiff = lineScore(engine.state.enemies, source, enemyPoint(b), profile.lineWidth)
        - lineScore(engine.state.enemies, source, enemyPoint(a), profile.lineWidth);
      if (Math.abs(scoreDiff) > 1e-9) return scoreDiff;
      const distanceDiff = logicalDistance(source, enemyPoint(b)) - logicalDistance(source, enemyPoint(a));
      if (Math.abs(distanceDiff) > 1e-9) return distanceDiff;
      return a.id - b.id;
    })[0];
  }

  if (profile.targetMode === "FOCUS") {
    return candidates.slice().sort((a, b) => {
      const ratioA = Number(a.hp) / Math.max(1, Number(a.maxHp) || 1);
      const ratioB = Number(b.hp) / Math.max(1, Number(b.maxHp) || 1);
      if (Math.abs(ratioA - ratioB) > 1e-9) return ratioA - ratioB;
      return remainingTime(a) - remainingTime(b);
    })[0];
  }

  return candidates.slice().sort((a, b) => remainingTime(a) - remainingTime(b) || a.id - b.id)[0];
}

function scatterTargets(engine, primary, count, radius) {
  const center = enemyPoint(primary);
  const nearby = engine.state.enemies
    .filter((enemy) => logicalDistance(enemyPoint(enemy), center) <= radius + enemyRadius(enemy))
    .sort((a, b) => remainingTime(a) - remainingTime(b) || a.id - b.id);
  if (!nearby.length) return Array(count).fill(primary);
  return Array.from({ length: count }, (_, index) => nearby[index % nearby.length]);
}

function cycleTargets(engine, type, primary, shotCount, profile) {
  if (type === WeaponType.MACHINE_GUN) return scatterTargets(engine, primary, shotCount, profile.effectRadius);
  if (type === WeaponType.RAPID) {
    const candidates = engine.state.enemies
      .filter((enemy) => enemy.id !== primary.id && logicalDistance(enemyPoint(enemy), enemyPoint(primary)) <= 0.16)
      .sort((a, b) => remainingTime(a) - remainingTime(b));
    if (candidates.length) return [primary, candidates[0], ...Array(Math.max(0, shotCount - 2)).fill(primary)].slice(0, shotCount);
  }
  return Array(shotCount).fill(primary);
}

function queueFor(engine) {
  let queue = pendingShots.get(engine);
  if (!queue) {
    queue = [];
    pendingShots.set(engine, queue);
  }
  return queue;
}

function recordMuzzle(projectile, launchAtSeconds) {
  runtimeMuzzles.push({
    id: runtimeFxId++,
    sourceColumn: projectile.sourceColumn,
    weaponType: projectile.visualWeaponType,
    projectileKind: projectile.projectileKind,
    x: projectile.sourceX,
    y: projectile.sourceY,
    createdAtSeconds: launchAtSeconds,
    lifeSeconds: MUZZLE_LIFE_SECONDS,
    emitterIndex: projectile.emitterIndex,
    emitterCount: projectile.emitterCount,
  });
}

function recordImpact(enemy, damage, context, typeOverride = null) {
  const point = enemyPoint(enemy);
  const lethal = Number(enemy.hp) - Number(damage) <= 0;
  runtimeImpacts.push({
    id: runtimeFxId++,
    type: typeOverride ?? (lethal ? (enemy.enemyType === "BOSS" ? "BOSS_KILL" : "KILL") : "HIT"),
    x: point.x,
    y: point.y,
    damage: Math.max(0, Math.trunc(Number(damage) || 0)),
    targetMaxHp: Math.max(1, Number(enemy.maxHp) || 1),
    sourceColumn: context?.sourceColumn ?? null,
    weaponType: context?.weaponType ?? null,
    projectileId: context?.projectileId ?? null,
    contributorCount: Math.max(1, Math.trunc(Number(context?.contributorCount) || 1)),
    projectileKind: context?.projectileKind ?? null,
    effectRadius: Math.max(0, Number(context?.effectRadius) || 0),
    lineWidth: Math.max(0, Number(context?.lineWidth) || 0),
    particleBudget: 14,
    createdAtSeconds: runtimeElapsedSeconds,
    lifeSeconds: IMPACT_LIFE_SECONDS,
  });
}

function scheduleProjectile(engine, projectile, launchAtSeconds) {
  queueFor(engine).push({ projectile, launchAtSeconds });
  recordMuzzle(projectile, launchAtSeconds);
}

function flushPendingShots(engine) {
  const queue = queueFor(engine);
  if (!queue.length) return;
  const now = Number(engine.state.elapsedSeconds) || 0;
  const keep = [];
  for (const item of queue) {
    if (item.launchAtSeconds <= now + 1e-9) {
      const targetExists = engine.state.enemies.some((enemy) => enemy.id === item.projectile.targetEnemyId);
      if (targetExists || !item.projectile.ignoresLaneRestriction) engine.state.projectiles.push(item.projectile);
    } else keep.push(item);
  }
  pendingShots.set(engine, keep);
}

function withVfxContext(engine, context, callback) {
  const previous = engine.__weaponVfxContext;
  engine.__weaponVfxContext = context;
  try {
    return callback();
  } finally {
    if (previous === undefined) delete engine.__weaponVfxContext;
    else engine.__weaponVfxContext = previous;
  }
}

function applyDamageBatch(engine, damageByEnemyId, context) {
  if (!damageByEnemyId.size) return false;
  let scoreChanged = false;
  const survivors = [];
  for (const enemy of engine.state.enemies) {
    const damage = Math.max(0, Math.trunc(damageByEnemyId.get(enemy.id) || 0));
    if (damage <= 0) {
      survivors.push(enemy);
      continue;
    }
    const nextHp = Number(enemy.hp) - damage;
    recordImpact(enemy, damage, context);
    withVfxContext(engine, { ...context, targetId: enemy.id }, () => {
      engine.pushVfxEvent(
        enemy,
        nextHp <= 0 ? (enemy.enemyType === "BOSS" ? "BOSS_KILL" : "KILL") : "HIT",
        damage,
      );
    });
    if (nextHp <= 0) {
      engine.state.score += Math.trunc(Number(enemy.maxHp) || 0);
      scoreChanged = true;
    } else survivors.push({ ...enemy, hp: nextHp });
  }
  engine.state.enemies = survivors;
  return scoreChanged;
}

function lineVictims(engine, source, target, width) {
  return engine.state.enemies
    .map((enemy) => ({ enemy, hit: pointSegmentDistance(enemyPoint(enemy), source, target) }))
    .filter(({ enemy, hit }) => hit.distance <= width * 0.5 + enemyRadius(enemy))
    .sort((a, b) => a.hit.t - b.hit.t || a.enemy.id - b.enemy.id);
}

function fireLaser(engine, column, target, power, profile) {
  const source = turretPoint(engine, column);
  const targetPoint = enemyPoint(target);
  const damageSplit = splitCycleDamage(power, profile.emitterOffsets.length);
  const damageByEnemyId = new Map();

  profile.emitterOffsets.forEach((offset, index) => {
    const origin = emitterOrigin(source, targetPoint, offset);
    const victims = lineVictims(engine, origin, targetPoint, profile.lineWidth);
    for (const { enemy } of victims) {
      damageByEnemyId.set(enemy.id, (damageByEnemyId.get(enemy.id) ?? 0) + damageSplit[index]);
    }
    runtimeBeams.push({
      id: runtimeFxId++,
      sourceColumn: column,
      weaponType: WeaponType.LASER,
      x1: origin.x,
      y1: origin.y,
      x2: targetPoint.x,
      y2: targetPoint.y,
      width: profile.lineWidth,
      createdAtSeconds: engine.state.elapsedSeconds,
      lifeSeconds: BEAM_LIFE_SECONDS,
      emitterIndex: index,
      emitterCount: profile.emitterOffsets.length,
    });
    recordMuzzle({
      sourceColumn: column,
      visualWeaponType: WeaponType.LASER,
      projectileKind: ProjectileKind.BEAM,
      sourceX: origin.x,
      sourceY: origin.y,
      emitterIndex: index,
      emitterCount: profile.emitterOffsets.length,
    }, engine.state.elapsedSeconds);
  });

  const scoreChanged = applyDamageBatch(engine, damageByEnemyId, {
    sourceColumn: column,
    weaponType: WeaponType.LASER,
    projectileId: null,
    contributorCount: profile.emitterOffsets.length,
    projectileKind: ProjectileKind.BEAM,
    effectRadius: 0,
    lineWidth: profile.lineWidth,
    attackSystemVersion: ATTACK_SYSTEM_VERSION,
  });
  engine.state.cooldowns[column] = fireIntervalSeconds(WeaponType.LASER);
  return scoreChanged;
}

function projectileFor(engine, column, target, damage, type, profile, emitterIndex, ignoresLaneRestriction) {
  const source = turretPoint(engine, column);
  const targetPoint = enemyPoint(target);
  const origin = emitterOrigin(source, targetPoint, profile.emitterOffsets[emitterIndex] ?? 0);
  return {
    id: engine.projectileId++,
    sourceColumn: column,
    targetEnemyId: target.id,
    damage,
    x: origin.x,
    y: origin.y,
    sourceX: origin.x,
    sourceY: origin.y,
    speed: projectileSpeed(type),
    weaponType: WeaponType.NORMAL,
    visualWeaponType: type,
    projectileKind: profile.kind,
    effectRadius: profile.effectRadius,
    lineWidth: profile.lineWidth,
    emitterIndex,
    emitterCount: profile.emitterOffsets.length,
    ignoresLaneRestriction: Boolean(ignoresLaneRestriction),
    attackSystemVersion: ATTACK_SYSTEM_VERSION,
  };
}

GameEngine.prototype.fireProjectile = function weaponAttackFire(column, preferredTarget, power, type, ignoresLaneRestriction) {
  const profile = feverRangeProfile(type, ignoresLaneRestriction);
  const target = selectWeaponTarget(this, column, type, ignoresLaneRestriction, preferredTarget);
  if (!target) return;

  if (type === WeaponType.LASER) {
    fireLaser(this, column, target, power, profile);
    return;
  }

  const count = profile.emitterOffsets.length;
  const damages = splitCycleDamage(power, count);
  const targets = cycleTargets(this, type, target, count, profile);
  const now = Number(this.state.elapsedSeconds) || 0;
  for (let index = 0; index < count; index += 1) {
    const shotTarget = targets[index] ?? target;
    const projectile = projectileFor(this, column, shotTarget, damages[index], type, profile, index, ignoresLaneRestriction);
    scheduleProjectile(this, projectile, now + (profile.shotDelays[index] ?? 0));
  }
  this.state.cooldowns[column] = fireIntervalSeconds(type);
};

function projectedEnemies(enemies, delta) {
  return enemies
    .map((enemy) => ({ ...enemy, progress: Number(enemy.progress) + Math.max(0, Number(enemy.speed) || 0) * delta }))
    .filter((enemy) => enemy.progress < 1);
}

function projectileTarget(projectile, enemies) {
  const ignoreLaneRestriction = Boolean(projectile.ignoresLaneRestriction);
  const existing = enemies.find(
    (enemy) => enemy.id === projectile.targetEnemyId && canAttack(projectile.sourceColumn, enemy, ignoreLaneRestriction),
  );
  if (existing || ignoreLaneRestriction) return existing ?? null;
  return selectTarget(projectile.sourceColumn, enemies, false);
}

function plannedImpact(projectile, enemies, delta) {
  if (!projectile?.attackSystemVersion) return null;
  const target = projectileTarget(projectile, enemies);
  if (!target) return null;
  const targetPoint = enemyPoint(target);
  const dx = targetPoint.x - Number(projectile.x);
  const dy = targetPoint.y - Number(projectile.y);
  const distance = Math.max(0.0001, Math.hypot(dx, dy));
  const moveDistance = Math.max(0, Number(projectile.speed) || 0) * delta;
  const hitRadius = target.enemyType === "BOSS" ? 0.065 : 0.035;
  if (distance > moveDistance + hitRadius) return null;
  return { projectile: { ...projectile }, target: { ...target }, point: targetPoint };
}

function applySecondaryImpact(engine, plan) {
  const projectile = plan.projectile;
  const type = projectile.visualWeaponType ?? projectile.weaponType;
  if (type !== WeaponType.EXPLOSIVE && type !== WeaponType.PIERCING) return false;
  const damageByEnemyId = new Map();

  if (type === WeaponType.EXPLOSIVE) {
    const radius = Math.max(0, Number(projectile.effectRadius) || weaponAttackProfile(type).effectRadius);
    for (const enemy of engine.state.enemies) {
      if (enemy.id === plan.target.id) continue;
      const distance = logicalDistance(enemyPoint(enemy), plan.point);
      const scale = circularDamageScale(distance, radius + enemyRadius(enemy));
      if (scale <= 0) continue;
      damageByEnemyId.set(enemy.id, Math.max(1, Math.trunc(projectile.damage * scale)));
    }
  } else {
    const source = { x: Number(projectile.sourceX), y: Number(projectile.sourceY) };
    const width = Math.max(0.001, Number(projectile.lineWidth) || weaponAttackProfile(type).lineWidth);
    const victims = engine.state.enemies
      .filter((enemy) => enemy.id !== plan.target.id)
      .map((enemy) => ({ enemy, hit: pointSegmentDistance(enemyPoint(enemy), source, plan.point) }))
      .filter(({ enemy, hit }) => hit.distance <= width * 0.5 + enemyRadius(enemy) && hit.t > 0 && hit.t < 1)
      .sort((a, b) => a.hit.t - b.hit.t || a.enemy.id - b.enemy.id);
    victims.forEach(({ enemy }, index) => {
      const scale = lineDamageScale(index + 1, WeaponType.PIERCING);
      damageByEnemyId.set(enemy.id, Math.max(1, Math.trunc(projectile.damage * scale)));
    });
  }

  return applyDamageBatch(engine, damageByEnemyId, {
    sourceColumn: projectile.sourceColumn,
    weaponType: type,
    projectileId: projectile.id,
    contributorCount: 1,
    projectileKind: projectile.projectileKind,
    effectRadius: Number(projectile.effectRadius) || 0,
    lineWidth: Number(projectile.lineWidth) || 0,
    attackSystemVersion: ATTACK_SYSTEM_VERSION,
  });
}

function pruneRuntimeFx(now) {
  runtimeBeams = runtimeBeams.filter((event) => now <= event.createdAtSeconds + event.lifeSeconds);
  runtimeMuzzles = runtimeMuzzles.filter((event) => now <= event.createdAtSeconds + event.lifeSeconds);
  runtimeImpacts = runtimeImpacts.filter((event) => now <= event.createdAtSeconds + event.lifeSeconds);
}

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function weaponAttackTick(deltaSeconds) {
  const delta = clampDelta(deltaSeconds);
  const scoreBefore = Number(this.state.score) || 0;
  const beforePositions = new Map(this.state.projectiles.map((projectile) => [
    projectile.id,
    { x: Number(projectile.x) || 0, y: Number(projectile.y) || 0 },
  ]));
  const beforeEnemies = projectedEnemies(this.state.enemies, delta);
  const candidates = this.state.projectiles.map((projectile) => ({ ...projectile }));
  const plans = candidates.map((projectile) => plannedImpact(projectile, beforeEnemies, delta)).filter(Boolean);

  runtimeElapsedSeconds = Number(this.state.elapsedSeconds) || runtimeElapsedSeconds;
  const result = originalTick.call(this, deltaSeconds);
  runtimeElapsedSeconds = Number(this.state.elapsedSeconds) || runtimeElapsedSeconds;
  const remainingIds = new Set(this.state.projectiles.map((projectile) => projectile.id));

  for (const plan of plans) {
    if (remainingIds.has(plan.projectile.id)) continue;
    const context = {
      sourceColumn: plan.projectile.sourceColumn,
      weaponType: plan.projectile.visualWeaponType ?? plan.projectile.weaponType,
      projectileId: plan.projectile.id,
      contributorCount: 1,
      projectileKind: plan.projectile.projectileKind,
      effectRadius: Number(plan.projectile.effectRadius) || 0,
      lineWidth: Number(plan.projectile.lineWidth) || 0,
    };
    recordImpact(plan.target, plan.projectile.damage, context);
    applySecondaryImpact(this, plan);
  }

  flushPendingShots(this);
  runtimeProjectiles = this.state.projectiles
    .filter((projectile) => projectile.attackSystemVersion === ATTACK_SYSTEM_VERSION)
    .map((projectile) => {
      const previous = beforePositions.get(projectile.id) ?? { x: projectile.sourceX, y: projectile.sourceY };
      return {
        ...projectile,
        weaponType: projectile.visualWeaponType ?? projectile.weaponType,
        previousX: previous.x,
        previousY: previous.y,
      };
    });
  pruneRuntimeFx(runtimeElapsedSeconds);
  if (result && typeof result === "object" && (Number(this.state.score) || 0) !== scoreBefore) result.scoreChanged = true;
  return result;
};

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function weaponAttackReset() {
  pendingShots.delete(this);
  runtimeBeams = [];
  runtimeMuzzles = [];
  runtimeProjectiles = [];
  runtimeImpacts = [];
  runtimeElapsedSeconds = 0;
  return originalReset.call(this);
};

const originalRestore = GameEngine.prototype.restore;
GameEngine.prototype.restore = function weaponAttackRestore(saved) {
  pendingShots.delete(this);
  runtimeBeams = [];
  runtimeMuzzles = [];
  runtimeProjectiles = [];
  runtimeImpacts = [];
  const restored = originalRestore.call(this, saved);
  runtimeElapsedSeconds = Number(this.state?.elapsedSeconds) || 0;
  return restored;
};

export function weaponAttackRuntimeFx() {
  const now = runtimeElapsedSeconds;
  return {
    beams: runtimeBeams
      .filter((event) => event.createdAtSeconds <= now + 0.001)
      .map((event) => ({ ...event, lifeRatio: Math.max(0, 1 - (now - event.createdAtSeconds) / event.lifeSeconds) })),
    muzzles: runtimeMuzzles
      .filter((event) => event.createdAtSeconds <= now + 0.001)
      .map((event) => ({ ...event, lifeRatio: Math.max(0, 1 - (now - event.createdAtSeconds) / event.lifeSeconds) })),
  };
}

export function weaponAttackRuntimeProjectiles() {
  return runtimeProjectiles.map((projectile) => ({ ...projectile }));
}

export function weaponAttackRuntimeImpacts() {
  const now = runtimeElapsedSeconds;
  return runtimeImpacts
    .filter((event) => event.createdAtSeconds <= now + 0.001)
    .map((event) => ({ ...event, ageMs: Math.max(0, (now - event.createdAtSeconds) * 1000) }));
}

export function pendingWeaponShotsForTest(engine) {
  return queueFor(engine).map((item) => ({ ...item, projectile: { ...item.projectile } }));
}

export function resetWeaponAttackRuntimeForTest(engine = null) {
  if (engine) pendingShots.delete(engine);
  runtimeBeams = [];
  runtimeMuzzles = [];
  runtimeProjectiles = [];
  runtimeImpacts = [];
  runtimeElapsedSeconds = Number(engine?.state?.elapsedSeconds) || 0;
}

export { ATTACK_SYSTEM_VERSION };
