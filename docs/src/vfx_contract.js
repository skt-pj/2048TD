export const VFX_EVENT_CONTRACT_VERSION = 2;
export const VFX_LIFETIME_SECONDS = 0.90;

export const VfxStrengthTier = Object.freeze({
  LIGHT: "LIGHT",
  MEDIUM: "MEDIUM",
  HEAVY: "HEAVY",
  CRITICAL: "CRITICAL",
});

export const VFX_BUDGET = Object.freeze({
  MAX_ACTIVE_EFFECTS: 48,
  MAX_ACTIVE_PARTICLES: 160,
  FEVER_AMBIENT_PARTICLES: 18,
  DEGRADE_AT_EFFECTS: 24,
  HEAVY_DEGRADE_AT_EFFECTS: 36,
  CRITICAL_DEGRADE_AT_EFFECTS: 44,
});

const VALID_EVENT_TYPES = new Set(["HIT", "KILL", "BOSS_KILL", "BASE_DAMAGE"]);

const BASE_PARTICLES = Object.freeze({
  LIGHT: 6,
  MEDIUM: 10,
  HEAVY: 16,
  CRITICAL: 28,
});

const TIER_PRIORITY = Object.freeze({
  LIGHT: 1,
  MEDIUM: 2,
  HEAVY: 3,
  CRITICAL: 4,
});

export function vfxStrengthTier(type, damage = 0, targetMaxHp = 0) {
  if (type === "BOSS_KILL") return VfxStrengthTier.CRITICAL;
  if (type === "KILL") return VfxStrengthTier.HEAVY;
  const maxHp = Math.max(0, Number(targetMaxHp) || 0);
  const ratio = maxHp > 0 ? Math.max(0, Number(damage) || 0) / maxHp : 0;
  if (type === "BASE_DAMAGE") {
    return ratio >= 0.10 ? VfxStrengthTier.CRITICAL : VfxStrengthTier.HEAVY;
  }
  if (ratio >= 0.35) return VfxStrengthTier.HEAVY;
  if (ratio >= 0.15) return VfxStrengthTier.MEDIUM;
  return VfxStrengthTier.LIGHT;
}

export function desiredParticleBudget(strengthTier, activeEffectCount = 0) {
  const base = BASE_PARTICLES[strengthTier] ?? BASE_PARTICLES.LIGHT;
  const count = Math.max(0, Math.trunc(Number(activeEffectCount) || 0));
  let scale = 1;
  if (count >= VFX_BUDGET.CRITICAL_DEGRADE_AT_EFFECTS) scale = 0.25;
  else if (count >= VFX_BUDGET.HEAVY_DEGRADE_AT_EFFECTS) scale = 0.50;
  else if (count >= VFX_BUDGET.DEGRADE_AT_EFFECTS) scale = 0.75;
  return Math.max(1, Math.floor(base * scale));
}

function nullableNumber(value, truncate = false) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return truncate ? Math.trunc(number) : number;
}

export function normalizeVfxEvent(event, nowSeconds = null) {
  if (!event || typeof event !== "object") return null;
  const createdRaw = Number(event.createdAtSeconds);
  const now = nowSeconds == null ? null : Math.max(0, Number(nowSeconds) || 0);
  const createdAtSeconds = Number.isFinite(createdRaw)
    ? Math.max(0, now == null ? createdRaw : Math.min(createdRaw, now))
    : (now ?? 0);
  const type = VALID_EVENT_TYPES.has(event.type) ? event.type : "HIT";
  const strengthTier = Object.values(VfxStrengthTier).includes(event.strengthTier)
    ? event.strengthTier
    : vfxStrengthTier(type, event.damage, event.targetMaxHp);
  return {
    ...event,
    contractVersion: VFX_EVENT_CONTRACT_VERSION,
    id: Math.max(0, Math.trunc(Number(event.id) || 0)),
    type,
    x: Math.max(0, Math.min(1, Number(event.x) || 0)),
    y: Number(event.y) || 0,
    damage: Math.max(0, Math.trunc(Number(event.damage) || 0)),
    createdAtSeconds,
    targetId: nullableNumber(event.targetId),
    targetType: typeof event.targetType === "string" ? event.targetType : null,
    targetMaxHp: Math.max(0, Number(event.targetMaxHp) || 0),
    sourceColumn: nullableNumber(event.sourceColumn, true),
    weaponType: typeof event.weaponType === "string" ? event.weaponType : null,
    projectileId: nullableNumber(event.projectileId),
    contributorCount: Math.max(0, Math.trunc(Number(event.contributorCount) || 0)),
    strengthTier,
    particleBudget: Math.max(0, Math.trunc(Number(event.particleBudget) || desiredParticleBudget(strengthTier, 0))),
  };
}

function eventPriority(event) {
  const typeBonus = event.type === "BOSS_KILL"
    ? 100
    : event.type === "BASE_DAMAGE"
      ? 80
      : event.type === "KILL"
        ? 50
        : 0;
  return typeBonus + (TIER_PRIORITY[event.strengthTier] ?? 1) * 10;
}

export function enforceVfxBudget(events, nowSeconds, reservedParticles = 0) {
  const now = Math.max(0, Number(nowSeconds) || 0);
  const normalized = (Array.isArray(events) ? events : [])
    .map((event) => normalizeVfxEvent(event, now))
    .filter(Boolean)
    .filter((event) => now - event.createdAtSeconds <= VFX_LIFETIME_SECONDS);

  const ranked = normalized.slice().sort((a, b) => {
    const priority = eventPriority(b) - eventPriority(a);
    if (priority !== 0) return priority;
    const recency = b.createdAtSeconds - a.createdAtSeconds;
    if (Math.abs(recency) > 1e-9) return recency;
    return b.id - a.id;
  });

  const kept = ranked.slice(0, VFX_BUDGET.MAX_ACTIVE_EFFECTS);
  let remainingParticles = Math.max(
    0,
    VFX_BUDGET.MAX_ACTIVE_PARTICLES - Math.max(0, Math.trunc(Number(reservedParticles) || 0)),
  );

  for (let index = 0; index < kept.length; index += 1) {
    const event = kept[index];
    const desired = desiredParticleBudget(event.strengthTier, kept.length);
    const allowed = Math.min(desired, remainingParticles);
    event.particleBudget = allowed;
    remainingParticles -= allowed;
  }

  return kept.sort((a, b) => {
    const time = a.createdAtSeconds - b.createdAtSeconds;
    if (Math.abs(time) > 1e-9) return time;
    return a.id - b.id;
  });
}
