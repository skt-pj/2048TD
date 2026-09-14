import { GameEngine } from "./game_engine.js";
import { WeaponType } from "./column_combat_rules.js";
import { feverActive } from "./combo_fever.js";
import { isLandscapeViewport, logicalPointToScreen } from "./orientation.js";
import { weaponAttackRuntimeFx } from "./weapon_attack_system.js?v=weapon-attacks-1";

const MAX_PARTICLES = 420;
const particles = [];
const previousProjectiles = new Map();
const seenImpactEvents = new Set();
let randomState = 0x2048cafe;

const COLORS = {
  NORMAL: [244, 251, 255],
  RAPID: [88, 168, 208],
  MACHINE_GUN: [105, 189, 137],
  PIERCING: [190, 166, 244],
  EXPLOSIVE: [255, 122, 24],
  LASER: [255, 53, 211],
  FEVER_CYAN: [0, 245, 255],
  FEVER_PINK: [255, 53, 211],
  SMOKE: [126, 139, 148],
  WHITE: [255, 255, 255],
};

function currentLandscapeHand() {
  if (typeof document === "undefined") return "left";
  return document.getElementById("app")?.classList.contains("handed-right") ? "right" : "left";
}

function nextRandom() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
}

function range(min, max) {
  return min + (max - min) * nextRandom();
}

function colorForWeapon(type) {
  return COLORS[type] ?? COLORS.WHITE;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function pushParticle(spec) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push({
    x: Number(spec.x) || 0,
    y: Number(spec.y) || 0,
    vx: Number(spec.vx) || 0,
    vy: Number(spec.vy) || 0,
    life: Math.max(0.01, Number(spec.life) || 0.3),
    maxLife: Math.max(0.01, Number(spec.life) || 0.3),
    size: Math.max(0.4, Number(spec.size) || 2),
    endSize: Math.max(0.1, Number(spec.endSize) || Number(spec.size) || 2),
    drag: Math.max(0, Number(spec.drag) || 0),
    gravity: Number(spec.gravity) || 0,
    color: spec.color ?? COLORS.WHITE,
    alpha: clamp01(spec.alpha ?? 1),
    kind: spec.kind ?? "dot",
    glow: Math.max(0, Number(spec.glow) || 0),
  });
}

function emitRadial(x, y, count, options = {}) {
  const safeCount = Math.max(0, Math.min(64, Math.trunc(count)));
  for (let i = 0; i < safeCount; i += 1) {
    const angle = range(0, Math.PI * 2);
    const speed = range(options.speedMin ?? 0.03, options.speedMax ?? 0.14);
    pushParticle({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: range(options.lifeMin ?? 0.18, options.lifeMax ?? 0.48),
      size: range(options.sizeMin ?? 1.2, options.sizeMax ?? 3.2),
      endSize: range(options.endSizeMin ?? 0.4, options.endSizeMax ?? 1.4),
      drag: options.drag ?? 3.0,
      gravity: options.gravity ?? 0,
      color: options.color ?? COLORS.WHITE,
      alpha: options.alpha ?? 0.95,
      kind: options.kind ?? "spark",
      glow: options.glow ?? 1,
    });
  }
}

function projectileKey(projectile) {
  return Number(projectile?.id) || `${projectile?.sourceColumn}:${projectile?.emitterIndex}:${projectile?.targetEnemyId}`;
}

function emitProjectileTrail(projectile, deltaSeconds) {
  const key = projectileKey(projectile);
  const current = { x: Number(projectile.x) || 0, y: Number(projectile.y) || 0 };
  const previous = previousProjectiles.get(key) ?? current;
  previousProjectiles.set(key, current);

  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const distance = Math.hypot(dx, dy);
  const type = projectile.visualWeaponType ?? projectile.weaponType;
  const kind = projectile.projectileKind ?? "PROJECTILE";
  let density = 70;
  let color = colorForWeapon(type);
  let smoke = false;

  if (type === WeaponType.RAPID) density = 52;
  else if (type === WeaponType.MACHINE_GUN) density = 62;
  else if (type === WeaponType.PIERCING) density = 86;
  else if (type === WeaponType.EXPLOSIVE || kind === "MISSILE") {
    density = 118;
    smoke = true;
  }

  const count = Math.max(1, Math.min(8, Math.ceil(distance * density + deltaSeconds * density * 0.08)));
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 1 : i / (count - 1);
    const x = previous.x + dx * t + range(-0.004, 0.004);
    const y = previous.y + dy * t + range(-0.004, 0.004);
    if (smoke) {
      pushParticle({
        x,
        y,
        vx: range(-0.018, 0.018),
        vy: range(0.006, 0.032),
        life: range(0.34, 0.72),
        size: range(2.4, 4.6),
        endSize: range(5.5, 9.0),
        drag: 1.7,
        color: nextRandom() < 0.28 ? COLORS.EXPLOSIVE : COLORS.SMOKE,
        alpha: range(0.25, 0.58),
        kind: "smoke",
        glow: 0,
      });
    } else {
      pushParticle({
        x,
        y,
        vx: -dx * range(2.0, 4.0) + range(-0.012, 0.012),
        vy: -dy * range(2.0, 4.0) + range(-0.012, 0.012),
        life: range(0.12, 0.28),
        size: range(1.0, 2.2),
        endSize: 0.3,
        drag: 4.2,
        color,
        alpha: 0.82,
        kind: "spark",
        glow: 1,
      });
    }
  }
}

function impactKey(event) {
  return [
    event.type,
    event.projectileId ?? "none",
    event.targetId ?? "none",
    Number(event.createdAtSeconds || 0).toFixed(4),
    Number(event.x || 0).toFixed(4),
    Number(event.y || 0).toFixed(4),
  ].join(":");
}

function emitImpact(event) {
  const type = event.weaponType ?? WeaponType.NORMAL;
  const color = colorForWeapon(type);
  const isKill = event.type === "KILL" || event.type === "BOSS_KILL";
  const bossKill = event.type === "BOSS_KILL";
  const budget = Math.max(6, Math.min(52, Math.trunc(Number(event.particleBudget) || (isKill ? 18 : 10))));
  const x = Number(event.x) || 0;
  const y = Number(event.y) || 0;

  if (type === WeaponType.EXPLOSIVE) {
    const radiusBoost = Math.max(1, Math.min(2.4, 1 + Number(event.effectRadius || 0) * 5));
    emitRadial(x, y, Math.min(46, budget + 12), {
      speedMin: 0.07 * radiusBoost,
      speedMax: 0.24 * radiusBoost,
      lifeMin: 0.22,
      lifeMax: 0.62,
      sizeMin: 1.6,
      sizeMax: 4.4,
      endSizeMin: 0.3,
      endSizeMax: 1.2,
      drag: 2.5,
      color: COLORS.EXPLOSIVE,
      glow: 1,
    });
    emitRadial(x, y, Math.min(20, Math.ceil(budget * 0.55)), {
      speedMin: 0.02,
      speedMax: 0.08,
      lifeMin: 0.48,
      lifeMax: 0.9,
      sizeMin: 3.0,
      sizeMax: 5.8,
      endSizeMin: 7.0,
      endSizeMax: 12.0,
      drag: 1.6,
      gravity: -0.015,
      color: COLORS.SMOKE,
      alpha: 0.42,
      kind: "smoke",
      glow: 0,
    });
  } else if (type === WeaponType.PIERCING) {
    emitRadial(x, y, budget + 5, {
      speedMin: 0.08,
      speedMax: 0.24,
      lifeMin: 0.14,
      lifeMax: 0.38,
      sizeMin: 1.0,
      sizeMax: 2.8,
      endSizeMin: 0.2,
      endSizeMax: 0.5,
      drag: 2.2,
      color,
      kind: "streak",
      glow: 1,
    });
  } else if (type === WeaponType.LASER) {
    emitRadial(x, y, budget + 8, {
      speedMin: 0.04,
      speedMax: 0.17,
      lifeMin: 0.18,
      lifeMax: 0.5,
      sizeMin: 1.4,
      sizeMax: 3.4,
      endSizeMin: 0.3,
      endSizeMax: 0.8,
      drag: 3.0,
      color,
      glow: 1,
    });
  } else {
    emitRadial(x, y, budget, {
      speedMin: 0.05,
      speedMax: 0.16,
      lifeMin: 0.14,
      lifeMax: 0.38,
      sizeMin: 1.0,
      sizeMax: 2.7,
      endSizeMin: 0.2,
      endSizeMax: 0.8,
      drag: 3.2,
      color,
      glow: 1,
    });
  }

  if (isKill) {
    emitRadial(x, y, bossKill ? 34 : 15, {
      speedMin: bossKill ? 0.10 : 0.06,
      speedMax: bossKill ? 0.30 : 0.20,
      lifeMin: 0.32,
      lifeMax: bossKill ? 0.9 : 0.6,
      sizeMin: 1.4,
      sizeMax: bossKill ? 4.8 : 3.2,
      endSizeMin: 0.2,
      endSizeMax: 1.0,
      drag: 2.0,
      color: bossKill ? COLORS.FEVER_PINK : COLORS.FEVER_CYAN,
      glow: 1,
    });
  }
}

function emitMuzzles(deltaSeconds) {
  const { muzzles = [], beams = [] } = weaponAttackRuntimeFx();
  for (const muzzle of muzzles) {
    const life = clamp01(muzzle.lifeRatio);
    const count = Math.max(1, Math.min(4, Math.ceil(deltaSeconds * 120 * life)));
    const color = colorForWeapon(muzzle.weaponType);
    for (let i = 0; i < count; i += 1) {
      const angle = range(-Math.PI, Math.PI);
      const speed = range(0.025, 0.10);
      pushParticle({
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: range(0.08, 0.22),
        size: range(1.5, 3.5),
        endSize: 0.4,
        drag: 5.0,
        color: nextRandom() < 0.32 ? COLORS.WHITE : color,
        alpha: 0.92,
        glow: 1,
      });
    }
  }

  for (const beam of beams) {
    const life = clamp01(beam.lifeRatio);
    const count = Math.max(1, Math.min(5, Math.ceil(deltaSeconds * 150 * life)));
    for (let i = 0; i < count; i += 1) {
      const t = nextRandom();
      const x = beam.x1 + (beam.x2 - beam.x1) * t;
      const y = beam.y1 + (beam.y2 - beam.y1) * t;
      pushParticle({
        x: x + range(-0.004, 0.004),
        y: y + range(-0.004, 0.004),
        vx: range(-0.025, 0.025),
        vy: range(-0.025, 0.025),
        life: range(0.10, 0.32),
        size: range(1.0, 2.8),
        endSize: 0.2,
        drag: 4.5,
        color: nextRandom() < 0.35 ? COLORS.WHITE : COLORS.LASER,
        alpha: 0.85,
        glow: 1,
      });
    }
  }
}

function emitFever(state, deltaSeconds) {
  if (!feverActive(state?.comboFever)) return;
  const baseCount = Math.max(1, Math.min(4, Math.ceil(deltaSeconds * 80)));
  for (let col = 0; col < 4; col += 1) {
    for (let i = 0; i < baseCount; i += 1) {
      pushParticle({
        x: (col + 0.5) / 4 + range(-0.026, 0.026),
        y: 0.94 + range(-0.018, 0.016),
        vx: range(-0.025, 0.025),
        vy: range(-0.15, -0.06),
        life: range(0.30, 0.72),
        size: range(1.2, 3.4),
        endSize: range(0.2, 1.0),
        drag: 1.6,
        color: nextRandom() < 0.5 ? COLORS.FEVER_CYAN : COLORS.FEVER_PINK,
        alpha: range(0.55, 0.9),
        glow: 1,
      });
    }
  }
}

function pruneSeenEvents(events) {
  if (seenImpactEvents.size < 180) return;
  const live = new Set(events.map(impactKey));
  for (const key of seenImpactEvents) {
    if (!live.has(key)) seenImpactEvents.delete(key);
  }
}

function updateParticles(state, deltaSeconds) {
  const dt = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const liveProjectileKeys = new Set();
  for (const projectile of state?.projectiles ?? []) {
    const key = projectileKey(projectile);
    liveProjectileKeys.add(key);
    emitProjectileTrail(projectile, dt);
  }
  for (const key of previousProjectiles.keys()) {
    if (!liveProjectileKeys.has(key)) previousProjectiles.delete(key);
  }

  const events = state?.vfxEvents ?? [];
  for (const event of events) {
    const key = impactKey(event);
    if (seenImpactEvents.has(key)) continue;
    seenImpactEvents.add(key);
    emitImpact(event);
  }
  pruneSeenEvents(events);
  emitMuzzles(dt);
  emitFever(state, dt);

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const dragFactor = Math.exp(-p.drag * dt);
    p.vx *= dragFactor;
    p.vy = p.vy * dragFactor + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const panel = document.getElementById("battle-panel");
  if (!panel) return null;
  let overlay = document.getElementById("particle-vfx-overlay");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "particle-vfx-overlay";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "4",
    });
    panel.appendChild(overlay);
  }
  return overlay;
}

function resizeOverlay(overlay) {
  const rect = overlay.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const widthPx = Math.max(1, Math.round(rect.width * dpr));
  const heightPx = Math.max(1, Math.round(rect.height * dpr));
  if (overlay.width !== widthPx || overlay.height !== heightPx) {
    overlay.width = widthPx;
    overlay.height = heightPx;
  }
  const ctx = overlay.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}

function particleScreenPoint(particle, width, height) {
  const logical = logicalPointToScreen(
    particle.x,
    particle.y,
    isLandscapeViewport(),
    currentLandscapeHand(),
  );
  return { x: logical.x * width, y: logical.y * height };
}

function drawParticle(ctx, particle, width, height) {
  const point = particleScreenPoint(particle, width, height);
  const ratio = clamp01(particle.life / particle.maxLife);
  const eased = ratio * ratio;
  const size = particle.endSize + (particle.size - particle.endSize) * ratio;
  const [r, g, b] = particle.color;
  const alpha = particle.alpha * eased;
  if (alpha <= 0.01) return;

  ctx.save();
  if (particle.kind !== "smoke") ctx.globalCompositeOperation = "lighter";

  if (particle.kind === "smoke") {
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  } else if (particle.kind === "streak") {
    const scale = Math.min(width, height);
    const tail = Math.max(3, size * 3.4);
    const velocityLength = Math.hypot(particle.vx, particle.vy) || 1;
    const nx = particle.vx / velocityLength;
    const ny = particle.vy / velocityLength;
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = Math.max(1, size * 0.75);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(point.x - nx * tail * Math.min(1.5, scale / 240), point.y - ny * tail * Math.min(1.5, scale / 240));
    ctx.stroke();
  } else {
    if (particle.glow > 0) {
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha * 0.20})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderParticles() {
  const overlay = ensureOverlay();
  if (!overlay) return;
  const { ctx, width, height } = resizeOverlay(overlay);
  for (const particle of particles) drawParticle(ctx, particle, width, height);
}

function clearParticleOverlay() {
  const overlay = typeof document !== "undefined" ? document.getElementById("particle-vfx-overlay") : null;
  if (overlay) {
    const ctx = overlay.getContext("2d");
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
  }
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function particleVfxReset() {
  particles.length = 0;
  previousProjectiles.clear();
  seenImpactEvents.clear();
  clearParticleOverlay();
  return originalReset.call(this);
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function particleVfxTick(deltaSeconds) {
  const result = originalTick.call(this, deltaSeconds);
  updateParticles(this.state, deltaSeconds);
  renderParticles();
  return result;
};

export function particleVfxStats() {
  return {
    activeParticles: particles.length,
    maxParticles: MAX_PARTICLES,
    trackedProjectiles: previousProjectiles.size,
    seenImpactEvents: seenImpactEvents.size,
  };
}

export function resetParticleVfxForTest() {
  particles.length = 0;
  previousProjectiles.clear();
  seenImpactEvents.clear();
}
