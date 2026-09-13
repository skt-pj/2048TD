const WEAPON_PROFILES = Object.freeze({
  NORMAL: Object.freeze({
    id: "W01",
    color: "137,148,164",
    projectile: Object.freeze({ mode: "BASIC", trailPx: 26, widthPx: 2.5, alpha: 0.82, afterimages: 1, bloomPx: 2 }),
    impact: Object.freeze({ mode: "SPARK", lifeMs: 280, maxPrimitives: 6, linePx: 22, ringPx: 12, radialStreaks: 6, alpha: 0.86 }),
  }),
  RAPID: Object.freeze({
    id: "W02",
    color: "88,168,208",
    projectile: Object.freeze({ mode: "RAPID", trailPx: 30, widthPx: 1.35, alpha: 0.78, afterimages: 3, bloomPx: 2 }),
    impact: Object.freeze({ mode: "NEEDLE", lifeMs: 200, maxPrimitives: 4, linePx: 26, ringPx: 8, radialStreaks: 4, alpha: 0.78 }),
  }),
  MACHINE_GUN: Object.freeze({
    id: "W03",
    color: "105,189,137",
    projectile: Object.freeze({ mode: "MACHINE_GUN", trailPx: 24, widthPx: 1.3, alpha: 0.66, afterimages: 2, bloomPx: 2 }),
    impact: Object.freeze({ mode: "DIRECTIONAL", lifeMs: 190, maxPrimitives: 4, linePx: 23, ringPx: 7, radialStreaks: 4, alpha: 0.70 }),
  }),
  PIERCING: Object.freeze({
    id: "W04",
    color: "170,98,255",
    projectile: Object.freeze({ mode: "PIERCING", trailPx: 62, widthPx: 2.4, alpha: 0.90, afterimages: 2, bloomPx: 7 }),
    impact: Object.freeze({ mode: "PIERCING", lifeMs: 340, maxPrimitives: 6, linePx: 88, ringPx: 0, radialStreaks: 5, alpha: 0.94 }),
  }),
  EXPLOSIVE: Object.freeze({
    id: "W05",
    color: "255,122,24",
    projectile: Object.freeze({ mode: "MISSILE", trailPx: 38, widthPx: 2.8, alpha: 0.92, afterimages: 3, bloomPx: 8 }),
    impact: Object.freeze({ mode: "EXPLOSIVE", lifeMs: 460, maxPrimitives: 12, linePx: 34, ringPx: 58, radialStreaks: 12, alpha: 0.96 }),
  }),
  LASER: Object.freeze({
    id: "W06",
    color: "255,53,211",
    projectile: Object.freeze({ mode: "LASER", trailPx: 84, widthPx: 3.0, alpha: 0.96, afterimages: 0, bloomPx: 14 }),
    impact: Object.freeze({ mode: "LASER_ENDPOINT", lifeMs: 340, maxPrimitives: 8, linePx: 72, ringPx: 28, radialStreaks: 8, alpha: 0.98 }),
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

function drawMissile(ctx, profile, spec, currentPoint, dir, tail, feverBoost) {
  const perp = { x: -dir.y, y: dir.x };
  for (let i = 1; i <= 4; i += 1) {
    const t = i / 5;
    const wobble = i % 2 === 0 ? 1.8 : -1.8;
    const x = currentPoint.x - dir.x * spec.trailPx * t + perp.x * wobble;
    const y = currentPoint.y - dir.y * spec.trailPx * t + perp.y * wobble;
    ctx.fillStyle = `rgba(210,220,226,${0.20 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(x, y, 4.5 + t * 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx * feverBoost, rgba(profile, 0.10));
  line(
    ctx,
    currentPoint.x - dir.x * 7,
    currentPoint.y - dir.y * 7,
    currentPoint.x - dir.x * 17,
    currentPoint.y - dir.y * 17,
    4.5 * feverBoost,
    "rgba(255,204,94,.88)",
  );
  line(
    ctx,
    currentPoint.x - dir.x * 3,
    currentPoint.y - dir.y * 3,
    currentPoint.x - dir.x * 12,
    currentPoint.y - dir.y * 12,
    2.0,
    "rgba(255,255,255,.95)",
  );
  line(
    ctx,
    currentPoint.x + dir.x * 7,
    currentPoint.y + dir.y * 7,
    currentPoint.x - dir.x * 7,
    currentPoint.y - dir.y * 7,
    6.0,
    rgba(profile, 0.94),
  );
  ctx.fillStyle = "rgba(255,244,222,.98)";
  ctx.beginPath();
  ctx.arc(currentPoint.x + dir.x * 7, currentPoint.y + dir.y * 7, 3.2, 0, Math.PI * 2);
  ctx.fill();
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
  const feverBoost = fever ? 1.16 : 1;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  if (spec.mode === "MISSILE") {
    drawMissile(ctx, profile, spec, currentPoint, dir, tail, feverBoost);
  } else if (spec.mode === "LASER") {
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx * feverBoost, rgba(profile, 0.16 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 5.0 * feverBoost, rgba(profile, 0.68 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 1.4, `rgba(255,255,255,${0.96 * spec.alpha})`);
  } else if (spec.mode === "PIERCING") {
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx, rgba(profile, 0.16 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.widthPx, rgba(profile, spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, 0.85, `rgba(244,251,255,${0.84 * spec.alpha})`);
  } else if (spec.mode === "MACHINE_GUN") {
    for (let i = -1; i <= 1; i += 1) {
      const offset = i * 1.7;
      line(
        ctx,
        currentPoint.x + perp.x * offset,
        currentPoint.y + perp.y * offset,
        tail.x + perp.x * offset,
        tail.y + perp.y * offset,
        i === 0 ? spec.widthPx : 0.72,
        rgba(profile, spec.alpha * (i === 0 ? 1 : 0.48)),
      );
    }
  } else {
    if (spec.bloomPx > 0) line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.bloomPx, rgba(profile, 0.10 * spec.alpha));
    line(ctx, currentPoint.x, currentPoint.y, tail.x, tail.y, spec.widthPx, rgba(profile, spec.alpha));
  }

  if (spec.mode !== "MISSILE") {
    for (let i = 1; i <= spec.afterimages; i += 1) {
      const t = i / (spec.afterimages + 1);
      const x = currentPoint.x - dir.x * spec.trailPx * t;
      const y = currentPoint.y - dir.y * spec.trailPx * t;
      const length = spec.mode === "RAPID" ? 5 : spec.mode === "LASER" ? 10 : 7;
      line(ctx, x, y, x - dir.x * length, y - dir.y * length, Math.max(0.7, spec.widthPx * 0.55), rgba(profile, spec.alpha * (0.52 - t * 0.20)));
    }
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
    const half = spec.linePx * (0.34 + 0.20 * progress) * killBoost;
    line(ctx, point.x - dir.x * half, point.y - dir.y * half, point.x + dir.x * half, point.y + dir.y * half, 9, rgba(profile, 0.12 * life));
    line(ctx, point.x - dir.x * half, point.y - dir.y * half, point.x + dir.x * half, point.y + dir.y * half, 2.8, rgba(profile, spec.alpha * life));
    line(ctx, point.x - dir.x * half * 0.8, point.y - dir.y * half * 0.8, point.x + dir.x * half * 0.8, point.y + dir.y * half * 0.8, 0.9, `rgba(255,255,255,${0.90 * life})`);
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 3.4;
      const start = 6 + i * 1.5;
      const length = 10 + i * 1.2;
      line(ctx, point.x + perp.x * offset + dir.x * start, point.y + perp.y * offset + dir.y * start, point.x + perp.x * offset + dir.x * (start + length), point.y + perp.y * offset + dir.y * (start + length), 1.1, rgba(profile, (0.76 - i * 0.05) * life));
    }
  } else if (spec.mode === "EXPLOSIVE") {
    const radius = (12 + spec.ringPx * progress) * killBoost;
    const innerRadius = radius * 0.58;
    ctx.fillStyle = `rgba(255,238,194,${0.16 * life})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, innerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,220,92,${0.88 * life})`;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, innerRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = rgba(profile, 0.84 * life);
    ctx.lineWidth = 2.7;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    const streaks = Math.max(6, Math.min(spec.radialStreaks, 6 + count));
    for (let i = 0; i < streaks; i += 1) {
      const angle = (i / streaks) * Math.PI * 2 + 0.18;
      const inner = 10 + 10 * progress;
      const outer = inner + 13 + (i % 3) * 5;
      line(ctx, point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner, point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer, i % 3 === 0 ? 2.6 : 1.35, rgba(profile, (0.62 + (i % 2) * 0.18) * life));
    }
  } else if (spec.mode === "LASER_ENDPOINT") {
    const beamLength = Math.min(spec.linePx * killBoost, Math.hypot(point.x - sourcePoint.x, point.y - sourcePoint.y));
    const bx = point.x - dir.x * beamLength;
    const by = point.y - dir.y * beamLength;
    line(ctx, point.x, point.y, bx, by, 14, rgba(profile, 0.14 * life));
    line(ctx, point.x, point.y, bx, by, 4.0, rgba(profile, 0.86 * life));
    line(ctx, point.x, point.y, bx, by, 1.2, `rgba(255,255,255,${0.98 * life})`);
    const endpointRadius = 6 + spec.ringPx * 0.48 * progress;
    ctx.strokeStyle = rgba(profile, 0.82 * life);
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(point.x, point.y, endpointRadius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < count; i += 1) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2 + progress * 0.9;
      const inner = 6 + 8 * progress;
      const outer = inner + 6 + (i % 2) * 4;
      line(ctx, point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner, point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer, 1.1, rgba(profile, 0.70 * life));
    }
  } else {
    const spread = spec.mode === "NEEDLE" ? 0.22 : spec.mode === "DIRECTIONAL" ? 0.34 : Math.PI * 2;
    const baseAngle = spec.mode === "SPARK" ? 0 : dir.angle;
    for (let i = 0; i < count; i += 1) {
      const t = count <= 1 ? 0.5 : i / (count - 1);
      const angle = spec.mode === "SPARK"
        ? baseAngle + (i / Math.max(1, count)) * Math.PI * 2
        : baseAngle + (t - 0.5) * spread;
      const start = 3 + 6 * progress;
      const length = spec.linePx * (0.44 + 0.22 * (i % 2)) * killBoost;
      line(ctx, point.x + Math.cos(angle) * start, point.y + Math.sin(angle) * start, point.x + Math.cos(angle) * (start + length), point.y + Math.sin(angle) * (start + length), spec.mode === "DIRECTIONAL" ? 0.85 : 1.25, rgba(profile, spec.alpha * life));
    }
    if (spec.ringPx > 0) {
      ctx.strokeStyle = rgba(profile, 0.48 * life);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(point.x, point.y, spec.ringPx * (0.5 + progress), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
  return count;
}
