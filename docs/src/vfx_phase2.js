import { GameEngine } from "./game_engine.js";
import { isLandscapeViewport, logicalPointToScreen } from "./orientation.js";
import { phase1ReactionProfile, phase1RuntimeEvents, phase1VisualAgeMs } from "./vfx_phase1.js?v=vfx-phase1-2";
import { drawPhase2Impact, drawPhase2ProjectileTrail, phase2WeaponProfile } from "./vfx_phase2_profiles.js?v=vfx-phase2-2";
import {
  weaponAttackRuntimeFx,
  weaponAttackRuntimeImpacts,
} from "./weapon_attack_system.js?v=weapon-attacks-1";

let runtimeProjectiles = [];

function currentLandscapeHand() {
  if (typeof document === "undefined") return "left";
  return document.getElementById("app")?.classList.contains("handed-right") ? "right" : "left";
}

function screenPoint(x, y, width, height) {
  const landscape = isLandscapeViewport();
  const logical = logicalPointToScreen(x, y, landscape, currentLandscapeHand());
  return { x: logical.x * width, y: logical.y * height, landscape };
}

function sourceLogicalPoint(projectile) {
  const sourceX = Number(projectile?.sourceX);
  const sourceY = Number(projectile?.sourceY);
  if (Number.isFinite(sourceX) && Number.isFinite(sourceY)) return { x: sourceX, y: sourceY };
  const column = Math.max(0, Math.min(3, Math.trunc(Number(projectile?.sourceColumn) || 0)));
  return { x: (column + 0.5) / 4, y: 0.955 };
}

function enemyLogicalX(enemy) {
  const x = Number(enemy?.x);
  if (Number.isFinite(x)) return Math.max(0, Math.min(1, x));
  if (enemy?.enemyType === "BOSS") return 0.5;
  return (Math.max(0, Math.min(3, Number(enemy?.lane) || 0)) + 0.5) / 4;
}

function visualProjectile(projectile) {
  return {
    ...projectile,
    weaponType: projectile.visualWeaponType ?? projectile.weaponType,
  };
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function phase2Reset() {
  runtimeProjectiles = [];
  return originalReset.call(this);
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase2Tick(deltaSeconds) {
  const before = new Map((this.state?.projectiles ?? []).map((projectile) => [
    projectile.id,
    { x: Number(projectile.x) || 0, y: Number(projectile.y) || 0 },
  ]));
  const result = originalTick.call(this, deltaSeconds);
  runtimeProjectiles = (this.state?.projectiles ?? []).map((projectile) => {
    const source = sourceLogicalPoint(projectile);
    const previous = before.get(projectile.id) ?? source;
    const target = this.state.enemies.find((enemy) => enemy.id === projectile.targetEnemyId) ?? null;
    return visualProjectile({
      ...projectile,
      previousX: previous.x,
      previousY: previous.y,
      targetX: target ? enemyLogicalX(target) : null,
      targetY: target ? Number(target.progress) || 0 : null,
    });
  });
  return result;
};

export function phase2RuntimeProjectiles() {
  return runtimeProjectiles.map((projectile) => ({ ...projectile }));
}

export function resetPhase2RuntimeForTest() {
  runtimeProjectiles = [];
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const panel = document.getElementById("battle-panel");
  const battlefield = document.getElementById("battlefield");
  if (!panel || !battlefield) return null;
  let overlay = document.getElementById("phase2-vfx-overlay");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "phase2-vfx-overlay";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "3",
      transformOrigin: "50% 50%",
      willChange: "transform",
    });
    panel.appendChild(overlay);
  }
  return { battlefield, overlay };
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
  return { ctx, width: rect.width, height: rect.height };
}

function drawCircleBoundary(ctx, point, radius, alpha, dash = []) {
  if (!Number.isFinite(radius) || radius <= 0) return;
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1.1;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawProjectileAttackGeometry(ctx, projectile, width, height) {
  if (!projectile?.attackSystemVersion) return;
  const targetX = Number(projectile.targetX);
  const targetY = Number(projectile.targetY);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
  const target = screenPoint(targetX, targetY, width, height);
  const logicalScale = Math.min(width, height);
  const radius = Math.max(0, Number(projectile.effectRadius) || 0) * logicalScale;
  const lineWidth = Math.max(0, Number(projectile.lineWidth) || 0) * logicalScale;

  if (radius > 0) {
    if (projectile.weaponType === "EXPLOSIVE") {
      drawCircleBoundary(ctx, target, radius * 0.34, 0.20, [3, 4]);
      drawCircleBoundary(ctx, target, radius * 0.68, 0.18, [5, 5]);
      drawCircleBoundary(ctx, target, radius, 0.24, [7, 5]);
    } else {
      drawCircleBoundary(ctx, target, radius, 0.18, [5, 5]);
    }
  }

  if (lineWidth > 0 && projectile.weaponType === "PIERCING") {
    const source = sourceLogicalPoint(projectile);
    const start = screenPoint(source.x, source.y, width, height);
    ctx.save();
    ctx.strokeStyle = "rgba(190,166,244,.15)";
    ctx.lineWidth = Math.max(1, lineWidth);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.restore();
  }
}

function projectileDirection(currentPoint, previousPoint, sourcePoint) {
  let dx = currentPoint.x - previousPoint.x;
  let dy = currentPoint.y - previousPoint.y;
  let length = Math.hypot(dx, dy);
  if (length < 0.01) {
    dx = currentPoint.x - sourcePoint.x;
    dy = currentPoint.y - sourcePoint.y;
    length = Math.hypot(dx, dy);
  }
  if (length < 0.01) return { x: 0, y: -1 };
  return { x: dx / length, y: dy / length };
}

function drawProjectileBody(ctx, projectile, currentPoint, previousPoint, sourcePoint, fever) {
  if (!projectile?.attackSystemVersion || projectile.weaponType === "EXPLOSIVE") return;
  const dir = projectileDirection(currentPoint, previousPoint, sourcePoint);
  const profile = phase2WeaponProfile(projectile.weaponType);
  if (!profile) return;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  if (projectile.weaponType === "NORMAL") {
    const radius = 4.4 * (fever ? 1.10 : 1);
    ctx.fillStyle = `rgba(${profile.color},.24)`;
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, radius * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(244,251,255,.96)";
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (projectile.weaponType === "RAPID") {
    ctx.strokeStyle = `rgba(${profile.color},.98)`;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(currentPoint.x - dir.x * 4, currentPoint.y - dir.y * 4);
    ctx.lineTo(currentPoint.x + dir.x * 4, currentPoint.y + dir.y * 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.96)";
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  } else if (projectile.weaponType === "MACHINE_GUN") {
    ctx.strokeStyle = `rgba(${profile.color},.94)`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(currentPoint.x - dir.x * 4.5, currentPoint.y - dir.y * 4.5);
    ctx.lineTo(currentPoint.x + dir.x * 3, currentPoint.y + dir.y * 3);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.90)";
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (projectile.weaponType === "PIERCING") {
    ctx.strokeStyle = `rgba(${profile.color},.30)`;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(currentPoint.x - dir.x * 9, currentPoint.y - dir.y * 9);
    ctx.lineTo(currentPoint.x + dir.x * 9, currentPoint.y + dir.y * 9);
    ctx.stroke();
    ctx.strokeStyle = "rgba(244,251,255,.98)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.restore();
}

function drawProjectileTrails(ctx, width, height) {
  const fever = document.getElementById("app")?.classList.contains("fever-active") ?? false;
  for (const projectile of runtimeProjectiles) {
    if (!phase2WeaponProfile(projectile.weaponType)) continue;
    const source = sourceLogicalPoint(projectile);
    const currentPoint = screenPoint(projectile.x, projectile.y, width, height);
    const previousPoint = screenPoint(projectile.previousX, projectile.previousY, width, height);
    const sourcePoint = screenPoint(source.x, source.y, width, height);
    drawProjectileAttackGeometry(ctx, projectile, width, height);
    drawPhase2ProjectileTrail(ctx, projectile, currentPoint, previousPoint, sourcePoint, fever);
    drawProjectileBody(ctx, projectile, currentPoint, previousPoint, sourcePoint, fever);
  }
}

function drawBeamEvents(ctx, width, height) {
  const { beams } = weaponAttackRuntimeFx();
  for (const beam of beams) {
    const start = screenPoint(beam.x1, beam.y1, width, height);
    const end = screenPoint(beam.x2, beam.y2, width, height);
    const life = Math.max(0, Math.min(1, Number(beam.lifeRatio) || 0));
    if (life <= 0) continue;
    const beamWidth = Math.max(4, Number(beam.width) * Math.min(width, height));
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(255,53,211,${0.18 * life})`;
    ctx.lineWidth = beamWidth * 2.6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,53,211,${0.92 * life})`;
    ctx.lineWidth = beamWidth;
    ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${0.98 * life})`;
    ctx.lineWidth = Math.max(1.4, beamWidth * 0.28);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${0.94 * life})`;
    ctx.beginPath();
    ctx.arc(end.x, end.y, Math.max(3.5, beamWidth * 0.55), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawMuzzleEvents(ctx, width, height) {
  const { muzzles } = weaponAttackRuntimeFx();
  for (const muzzle of muzzles) {
    const point = screenPoint(muzzle.x, muzzle.y, width, height);
    const life = Math.max(0, Math.min(1, Number(muzzle.lifeRatio) || 0));
    if (life <= 0) continue;
    const profile = phase2WeaponProfile(muzzle.weaponType);
    if (!profile) continue;
    const radius = 3 + 8 * (1 - life);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(${profile.color},${0.36 * life})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.92 * life})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(1.8, radius * 0.45), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawImpactEvent(ctx, event, width, height, ageMs) {
  if (!phase2WeaponProfile(event.weaponType)) return;
  const point = screenPoint(event.x, event.y, width, height);
  const sourceColumn = Number(event.sourceColumn);
  const sourceX = Number.isFinite(sourceColumn) ? (Math.max(0, Math.min(3, sourceColumn)) + 0.5) / 4 : event.x;
  const sourcePoint = screenPoint(sourceX, 0.955, width, height);
  drawPhase2Impact(ctx, event, point, sourcePoint, ageMs);
}

function drawExactImpactGeometry(ctx, width, height) {
  const firstByProjectile = new Map();
  for (const event of weaponAttackRuntimeImpacts()) {
    const key = event.projectileId ?? `beam:${event.sourceColumn}:${event.createdAtSeconds}`;
    if (!firstByProjectile.has(key)) firstByProjectile.set(key, event);
  }
  for (const event of firstByProjectile.values()) {
    const life = Math.max(0, 1 - Number(event.ageMs || 0) / 520);
    if (life <= 0) continue;
    const point = screenPoint(event.x, event.y, width, height);
    const logicalScale = Math.min(width, height);
    const radius = Math.max(0, Number(event.effectRadius) || 0) * logicalScale;
    if (event.weaponType === "EXPLOSIVE" && radius > 0) {
      drawCircleBoundary(ctx, point, radius * 0.34, 0.28 * life);
      drawCircleBoundary(ctx, point, radius * 0.68, 0.24 * life);
      drawCircleBoundary(ctx, point, radius, 0.34 * life);
    }
    if (event.weaponType === "PIERCING" && Number(event.lineWidth) > 0) {
      const sourceColumn = Math.max(0, Math.min(3, Math.trunc(Number(event.sourceColumn) || 0)));
      const source = screenPoint((sourceColumn + 0.5) / 4, 0.955, width, height);
      ctx.save();
      ctx.strokeStyle = `rgba(190,166,244,${0.18 * life})`;
      ctx.lineWidth = Math.max(1, Number(event.lineWidth) * logicalScale);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function drawWeaponImpacts(ctx, width, height, nowMs) {
  for (const event of phase1RuntimeEvents()) {
    if (event.type !== "HIT" && event.type !== "KILL") continue;
    const profile = phase1ReactionProfile(event.type);
    const ageMs = phase1VisualAgeMs(event, nowMs);
    if (ageMs > Math.max(profile.lifeMs, 500)) continue;
    drawImpactEvent(ctx, event, width, height, ageMs);
  }
  drawExactImpactGeometry(ctx, width, height);
}

function renderPhase2Frame(nowMs) {
  const surfaces = ensureOverlay();
  if (!surfaces) return;
  const { battlefield, overlay } = surfaces;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);
  drawProjectileTrails(ctx, width, height);
  drawBeamEvents(ctx, width, height);
  drawMuzzleEvents(ctx, width, height);
  drawWeaponImpacts(ctx, width, height, nowMs);
  overlay.style.transform = battlefield.style.transform || "translate3d(0, 0, 0)";
}

function startPhase2Loop() {
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function") return;
  const frame = (timestamp) => {
    renderPhase2Frame(timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

startPhase2Loop();
