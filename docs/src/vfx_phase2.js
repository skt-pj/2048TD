import { GameEngine } from "./game_engine.js";
import { isLandscapeViewport, logicalPointToScreen } from "./orientation.js";
import { phase1ReactionProfile, phase1RuntimeEvents, phase1VisualAgeMs } from "./vfx_phase1.js?v=vfx-phase1-2";
import { drawPhase2Impact, drawPhase2ProjectileTrail, phase2WeaponProfile } from "./vfx_phase2_profiles.js?v=vfx-phase2-1";

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
  const column = Math.max(0, Math.min(3, Math.trunc(Number(projectile?.sourceColumn) || 0)));
  return { x: (column + 0.5) / 4, y: 0.955 };
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
    return {
      ...projectile,
      previousX: previous.x,
      previousY: previous.y,
    };
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

function drawProjectileTrails(ctx, width, height) {
  const fever = document.getElementById("app")?.classList.contains("fever-active") ?? false;
  for (const projectile of runtimeProjectiles) {
    if (!phase2WeaponProfile(projectile.weaponType)) continue;
    const source = sourceLogicalPoint(projectile);
    const currentPoint = screenPoint(projectile.x, projectile.y, width, height);
    const previousPoint = screenPoint(projectile.previousX, projectile.previousY, width, height);
    const sourcePoint = screenPoint(source.x, source.y, width, height);
    drawPhase2ProjectileTrail(ctx, projectile, currentPoint, previousPoint, sourcePoint, fever);
  }
}

function drawWeaponImpacts(ctx, width, height, nowMs) {
  for (const event of phase1RuntimeEvents()) {
    if ((event.type !== "HIT" && event.type !== "KILL") || !phase2WeaponProfile(event.weaponType)) continue;
    const profile = phase1ReactionProfile(event.type);
    const ageMs = phase1VisualAgeMs(event, nowMs);
    if (ageMs > Math.max(profile.lifeMs, 400)) continue;
    const point = screenPoint(event.x, event.y, width, height);
    const sourceColumn = Number(event.sourceColumn);
    const sourceX = Number.isFinite(sourceColumn) ? (Math.max(0, Math.min(3, sourceColumn)) + 0.5) / 4 : event.x;
    const sourcePoint = screenPoint(sourceX, 0.955, width, height);
    drawPhase2Impact(ctx, event, point, sourcePoint, ageMs);
  }
}

function renderPhase2Frame(nowMs) {
  const surfaces = ensureOverlay();
  if (!surfaces) return;
  const { battlefield, overlay } = surfaces;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);
  drawProjectileTrails(ctx, width, height);
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
