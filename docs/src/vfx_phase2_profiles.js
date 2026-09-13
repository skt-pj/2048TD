const WEAPON_PROFILES = Object.freeze({
  NORMAL: Object.freeze({
    id: "W01",
    color: "137,148,164",
    projectile: Object.freeze({ mode: "BASIC", trailPx: 16, widthPx: 1.8, alpha: 0.68, afterimages: 0, bloomPx: 0 }),
    impact: Object.freeze({ mode: "SPARK", lifeMs: 260, maxPrimitives: 4, linePx: 18, ringPx: 0, radialStreaks: 4, alpha: 0.74 }),
  }),
  RAPID: Object.freeze({
    id: "W02",
    color: "88,168,208",
    projectile: Object.freeze({ mode: "RAPID", trailPx: 22, widthPx: 0.9, alpha: 0.62, afterimages: 2, bloomPx: 0 }),
    impact: Object.freeze({ mode: "NEEDLE", lifeMs: 180, maxPrimitives: 3, linePx: 22, ringPx: 0, radialStreaks: 3, alpha: 0.66 }),
  }),
  MACHINE_GUN: Object.freeze({
    id: "W03",
    color: "105,189,137",
    projectile: Object.freeze({ mode: "MACHINE_GUN", trailPx: 19, widthPx: 1.0, alpha: 0.46, afterimages: 2, bloomPx: 0 }),
    impact: Object.freeze({ mode: "DIRECTIONAL", lifeMs: 160, maxPrimitives: 3, linePx: 19, ringPx: 0, radialStreaks: 3, alpha: 0.52 }),
  }),
  PIERCING: Object.freeze({
    id: "W04",
    color: "170,98,255",
    projectile: Object.freeze({ mode: "PIERCING", trailPx: 48, widthPx: 1.9, alpha: 0.78, afterimages: 2, bloomPx: 5 }),
    impact: Object.freeze({ mode: "PIERCING", lifeMs: 300, maxPrimitives: 5, linePx: 72, ringPx: 0, radialStreaks: 4, alpha: 0.84 }),
  }),
  EXPLOSIVE: Object.freeze({
    id: "W05",
    color: "255,122,24",
    projectile: Object.freeze({ mode: "EXPLOSIVE", trailPx: 18, widthPx: 2.0, alpha: 0.72, afterimages: 1, bloomPx: 5 }),
    impact: Object.freeze({ mode: "EXPLOSIVE", lifeMs: 380, maxPrimitives: 8, linePx: 30, ringPx: 42, radialStreaks: 10, alpha: 0.86 }),
  }),
  LASER: Object.freeze({
    id: "W06",
    color: "255,53,211",
    projectile: Object.freeze({ mode: "LASER", trailPx: 66, widthPx: 2.0, alpha: 0.86, afterimages: 3, bloomPx: 11 }),
    impact: Object.freeze({ mode: "LASER_ENDPOINT", lifeMs: 300, maxPrimitives: 6, linePx: 54, ringPx: 24, radialStreaks: 6, alpha: 0.90 }),
  }),
});

export const PHASE2_WEAPON_TYPES = Object.freeze(Object.keys(WEAPON_PROFILES));
export const PHASE2_WEAPON_PROFILES = WEAPON_PROFILES;

export function phase2WeaponProfile(weaponType) {
  return WEAPON_PROFILES[String(weaponType ?? "")] ?? null;
}

export function phase2ImpactPrimitiveCount(event) {
  const profile = phase2WeaponProfile(event?.weaponType);
  if (!profile) return 0;
  const budget = Math.max(0, Math.trunc(Number(event?.particleBudget) || 0));
  return Math.min(profile.impact.maxPrimitives, budget);
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function rgba(profile, alpha) {
  return `rgba(${profile.color},${Math.max(0, Math.min(1, alpha))})`;
}

function direction(current, previous, source) {
  let dx = Number(current?.x) - Number(previous?.x);
  let dy = Number(current?.y) - Number(previous?.y);
  let distance = Math.hypot(dx, dy);
  if (distance < 0.01) {
    dx = Number(current?.x) - Number(source?.x);
    dy = Number(current?.y) - Number(source?.y);
    distance = Math.hypot(dx, dy);
  }
  if (distance < 0.01) return { x: 0, y: -1 };
  return { x: dx / distance, y: dy / distance };
}

function line(ctx, ax, ay, bx, by, width, stroke) {
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

export function drawPhase2ProjectileTrail(ctx, projectile, currentPoint, previousPoint, sourcePoint, fever = false) {
  const profile = phase2WeaponProfile(projectile?.weaponType);
  if (!profile || !ctx) return false;
  const spec = profile.projectile;
  const dir = direction(currentPoint, previousPoint, sourcePoint);
  const perp = { x: -dir.y, y: dir.x };
  const tail = {
    x: currentPoint.x - dir.x * spec.trailPx,
    y: currentPoint.y - dir.y * spec.trailPx,
  };
  const feverBoost = fever ? 1.12 : 1;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  if (spec.mode === "LASER") {
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx * feverBoost, rgba(profile, 0.14 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 4.2 * feverBoost, rgba(profile, 0.60 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 1.25, `rgba(255,255,255,${0.90 * spec.alpha})`);
  } else if (spec.mode === "PIERCING") {
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx, rgba(profile, 0.13 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.widthPx, rgba(profile, spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 0.7, `rgba(244,251,255,${0.72 * spec.alpha})`);
  } else if (spec.mode === "MACHINE_GUN") {
    for (let i = -1; i <= 1; i += 1) {
      const offset = i * 1.7;
      line(
        ctx,
        currentPoint.x + perp.x * offset,
        currentPoint.y + perp.y * offset,
        tail.x + perp.x * offset,
        tail.y + perp.y * offset,
        i === 0 ? spec.widthPx : 0.65,
        rgba(profile, spec.alpha * (i === 0 ? 1 : 0.55)),
      );
    }
  } else {
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.widthPx, rgba(profile, spec.alpha));
  }

  if (spec.mode === "EXPLOSIVE") {
    ctx.strokeStyle = rgba(profile, 0.62 * spec.alpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, 6.5, 0, Math.PI * 1.35);
    ctx.stroke();
  }

  for (let i = 1; i <= spec.afterimages; i += 1) {
    const t = i / (spec.afterimages + 1);
    const x = currentPoint.x - dir.x * spec.trailPx * t;
    const y = currentPoint.y - dir.y * spec.trailPx * t;
    const length = spec.mode === "RAPID" ? 4 : spec.mode === "LASER" ? 9 : 6;
    line(ctx, x, y, x - dir.x * length, y - dir.y * length, Math.max(0.6, spec.widthPx * 0.55), rgba(profile, spec.alpha * (0.46 - t * 0.18)));
  }

  ctx.restore();
  return true;
}

function impactDirection(point, sourcePoint) {
  const dx = Number(point?.x) - Number(sourcePoint?.x);
  const dy = Number(point?.y) - Number(sourcePoint?.y);
  const distance = Math.hypot(dx, dy);
  if (distance < 0.01) return { x: 0, y: -1, angle: -Math.PI / 2 };
  return { x: dx / distance, y: dy / distance, angle: Math.atan2(dy, dx) };
}

export function drawPhase2Impact(ctx, event, point, sourcePoint, ageMs) {
  const profile = phase2WeaponProfile(event?.weaponType);
  if (!profile || !ctx || event?.type === "BOSS_KILL") return 0;
  const spec = profile.impact;
  const progress = clamp01(Number(ageMs) / spec.lifeMs);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const count = phase2ImpactPrimitiveCount(event);
  const dir = impactDirection(point, sourcePoint);
  const perp = { x: -dir.y, y: dir.x };
  const killBoost = event?.type === "KILL" ? 1.18 : 1;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  if (spec.mode === "PIERCING") {
    const half = spec.linePx * (0.30 + 0.18 * progress) * killBoost;
    line(ctx, point.x - dir.x * half, point.y - dir.y * half, point.x + dir.x * half, point.y + dir.y * half, 7, rgba(profile, 0.10 * life));
    line(ctx, point.x - dir.x * half, point.y - dir.y * half, point.x + dir.x * half, point.y + dir.y * half, 2.2, rgba(profile, spec.alpha * life));
    line(ctx, point.x - dir.x * half * 0.8, point.y - dir.y * half * 0.8, point.x + dir.x * half * 0.8, point.y + dir.y * half * 0.8, 0.8, `rgba(255,255,255,${0.80 * life})`);
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 3.2;
      const start = 5 + i * 1.4;
      const length = 8 + i * 1.1;
      line(ctx, point.x + perp.x * offset + dir.x * start, point.y + perp.y * offset + dir.y * start, point.x + perp.x * offset + dir.x * (start + length), point.y + perp.y * offset + dir.y * (start + length), 1.0, rgba(profile, (0.70 - i * 0.06) * life));
    }
  } else if (spec.mode === "EXPLOSIVE") {
    const radius = (10 + spec.ringPx * progress) * killBoost;
    ctx.strokeStyle = rgba(profile, 0.76 * life);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    const streaks = Math.max(4, Math.min(spec.radialStreaks, 4 + count));
    for (let i = 0; i < streaks; i += 1) {
      const angle = (i / streaks) * Math.PI * 2 + 0.18;
      const inner = 8 + 8 * progress;
      const outer = inner + 10 + (i % 3) * 4;
      line(ctx, point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner, point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer, i % 3 === 0 ? 2.3 : 1.25, rgba(profile, (0.56 + (i % 2) * 0.18) * life));
    }
  } else if (spec.mode === "LASER_ENDPOINT") {
    const beamLength = Math.min(spec.linePx * killBoost, Math.hypot(point.x - sourcePoint.x, point.y - sourcePoint.y));
    const bx = point.x - dir.x * beamLength;
    const by = point.y - dir.y * beamLength;
    line(ctx, point.x, point.y, bx, by, 11, rgba(profile, 0.12 * life));
    line(ctx, point.x, point.y, bx, by, 3.2, rgba(profile, 0.78 * life));
    line(ctx, point.x, point.y, bx, by, 1.0, `rgba(255,255,255,${0.92 * life})`);
    const endpointRadius = 5 + spec.ringPx * 0.45 * progress;
    ctx.strokeStyle = rgba(profile, 0.74 * life);
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(point.x, point.y, endpointRadius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + progress * 0.9;
      const inner = 5 + 7 * progress;
      const outer = inner + 5 + (i % 2) * 3;
      line(ctx, point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner, point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer, 1.0, rgba(profile, 0.64 * life));
    }
  } else {
    const spread = spec.mode === "NEEDLE" ? 0.18 : spec.mode === "DIRECTIONAL" ? 0.30 : Math.PI * 2;
    const baseAngle = spec.mode === "SPARK" ? 0 : dir.angle;
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const angle = spec.mode === "SPARK"
        ? baseAngle + (i / Math.max(1, count)) * Math.PI * 2
        : baseAngle + (t - 0.5) * spread;
      const start = 3 + 5 * progress;
      const length = spec.linePx * (0.42 + 0.20 * (i % 2)) * killBoost;
      line(ctx, point.x + Math.cos(angle) * start, point.y + Math.sin(angle) * start, point.x + Math.cos(angle) * (start + length), point.y + Math.sin(angle) * (start + length), spec.mode === "DIRECTIONAL" ? 0.75 : 1.15, rgba(profile, spec.alpha * life));
    }
  }

  ctx.restore();
  return count;
}
