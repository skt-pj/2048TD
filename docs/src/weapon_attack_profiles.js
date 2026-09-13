import { WeaponType } from "./column_combat_rules.js";

export const ProjectileKind = Object.freeze({
  BULLET: "BULLET",
  TRACER: "TRACER",
  SLUG: "SLUG",
  MISSILE: "MISSILE",
  BEAM: "BEAM",
});

const PROFILES = Object.freeze({
  [WeaponType.NORMAL]: Object.freeze({
    kind: ProjectileKind.BULLET,
    range: 0.82,
    emitterOffsets: Object.freeze([0]),
    shotDelays: Object.freeze([0]),
    targetMode: "FRONT",
    effectShape: "POINT",
    effectRadius: 0,
    lineWidth: 0,
    damageFalloff: Object.freeze([1]),
  }),
  [WeaponType.RAPID]: Object.freeze({
    kind: ProjectileKind.TRACER,
    range: 0.88,
    emitterOffsets: Object.freeze([-0.012, 0.012]),
    shotDelays: Object.freeze([0, 0]),
    targetMode: "FOCUS",
    effectShape: "MULTI_POINT",
    effectRadius: 0,
    lineWidth: 0,
    damageFalloff: Object.freeze([1, 1]),
  }),
  [WeaponType.MACHINE_GUN]: Object.freeze({
    kind: ProjectileKind.TRACER,
    range: 0.74,
    emitterOffsets: Object.freeze([-0.018, -0.006, 0.006, 0.018]),
    shotDelays: Object.freeze([0, 0.04, 0.08, 0.12]),
    targetMode: "SCATTER",
    effectShape: "SCATTER",
    effectRadius: 0.12,
    lineWidth: 0,
    damageFalloff: Object.freeze([1, 1, 1, 1]),
  }),
  [WeaponType.PIERCING]: Object.freeze({
    kind: ProjectileKind.SLUG,
    range: 1.10,
    emitterOffsets: Object.freeze([-0.009, 0.009]),
    shotDelays: Object.freeze([0, 0.035]),
    targetMode: "LINE",
    effectShape: "LINE",
    effectRadius: 0,
    lineWidth: 0.030,
    damageFalloff: Object.freeze([1, 0.82, 0.66, 0.52, 0.40]),
  }),
  [WeaponType.EXPLOSIVE]: Object.freeze({
    kind: ProjectileKind.MISSILE,
    range: 1.02,
    emitterOffsets: Object.freeze([-0.016, 0.016]),
    shotDelays: Object.freeze([0, 0.08]),
    targetMode: "CLUSTER",
    effectShape: "CIRCLE",
    effectRadius: 0.18,
    lineWidth: 0,
    damageFalloff: Object.freeze([1, 0.72, 0.42]),
  }),
  [WeaponType.LASER]: Object.freeze({
    kind: ProjectileKind.BEAM,
    range: 1.12,
    emitterOffsets: Object.freeze([-0.010, 0.010]),
    shotDelays: Object.freeze([0, 0]),
    targetMode: "LINE",
    effectShape: "THICK_LINE",
    effectRadius: 0,
    lineWidth: 0.042,
    damageFalloff: Object.freeze([1, 1, 1, 1, 1, 1]),
  }),
});

export const WEAPON_ATTACK_PROFILES = PROFILES;

export function weaponAttackProfile(type) {
  return PROFILES[type] ?? PROFILES[WeaponType.NORMAL];
}

export function enemyLogicalX(enemy) {
  const x = Number(enemy?.x);
  if (Number.isFinite(x)) return Math.max(0, Math.min(1, x));
  if (enemy?.enemyType === "BOSS") return 0.5;
  return (Math.max(0, Math.min(3, Number(enemy?.lane) || 0)) + 0.5) / 4;
}

export function logicalDistance(a, b) {
  return Math.hypot(Number(a?.x) - Number(b?.x), Number(a?.y) - Number(b?.y));
}

export function pointSegmentDistance(point, start, end) {
  const vx = Number(end?.x) - Number(start?.x);
  const vy = Number(end?.y) - Number(start?.y);
  const wx = Number(point?.x) - Number(start?.x);
  const wy = Number(point?.y) - Number(start?.y);
  const lengthSquared = vx * vx + vy * vy;
  if (lengthSquared <= 1e-9) return { distance: Math.hypot(wx, wy), t: 0 };
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / lengthSquared));
  const px = Number(start?.x) + vx * t;
  const py = Number(start?.y) + vy * t;
  return {
    distance: Math.hypot(Number(point?.x) - px, Number(point?.y) - py),
    t,
  };
}

export function enemyPoint(enemy) {
  return { x: enemyLogicalX(enemy), y: Number(enemy?.progress) || 0 };
}

export function feverRangeProfile(type, feverActive) {
  const profile = weaponAttackProfile(type);
  if (!feverActive) return profile;
  const radiusScale = type === WeaponType.EXPLOSIVE || type === WeaponType.MACHINE_GUN ? 1.15 : 1;
  const lineScale = type === WeaponType.PIERCING || type === WeaponType.LASER ? 1.20 : 1;
  return {
    ...profile,
    effectRadius: profile.effectRadius * radiusScale,
    lineWidth: profile.lineWidth * lineScale,
  };
}

export function circularDamageScale(distance, radius) {
  if (radius <= 0 || distance > radius) return 0;
  const ratio = distance / radius;
  if (ratio <= 0.34) return 1;
  if (ratio <= 0.68) return 0.72;
  return 0.42;
}

export function lineDamageScale(order, type = WeaponType.PIERCING) {
  const profile = weaponAttackProfile(type);
  const table = profile.damageFalloff;
  return table[Math.min(Math.max(0, order), table.length - 1)] ?? 0;
}

export function emitterOrigin(turret, target, lateralOffset = 0, forwardOffset = 0.012) {
  const dx = Number(target?.x) - Number(turret?.x);
  const dy = Number(target?.y) - Number(turret?.y);
  const distance = Math.max(1e-6, Math.hypot(dx, dy));
  const dirX = dx / distance;
  const dirY = dy / distance;
  const rightX = -dirY;
  const rightY = dirX;
  return {
    x: Number(turret?.x) + rightX * lateralOffset + dirX * forwardOffset,
    y: Number(turret?.y) + rightY * lateralOffset + dirY * forwardOffset,
  };
}

export function splitCycleDamage(totalDamage, shotCount) {
  const count = Math.max(1, Math.trunc(Number(shotCount) || 1));
  const total = Math.max(0, Math.trunc(Number(totalDamage) || 0));
  const base = Math.floor(total / count);
  const remainder = total - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
