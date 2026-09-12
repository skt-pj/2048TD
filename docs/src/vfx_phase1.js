import { GameEngine } from "./game_engine.js";
import { isLandscapeViewport, logicalPointToScreen } from "./orientation.js";

export const PHASE1_TIMING = Object.freeze({
  IMPACT_HOLD_MS: 60,
  HIT_FLASH_MS: 120,
  HIT_LIFE_MS: 360,
  KILL_LIFE_MS: 560,
  BASE_DAMAGE_LIFE_MS: 480,
  RECOIL_MS: 120,
});

const MAX_PRESENTATION_EVENTS = 64;
const presentationEvents = [];
let syntheticEventId = 1;

function clockMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function eventObservedAt(event) {
  return Number(event?.observedAtMs) || 0;
}

export function phase1ReactionProfile(type) {
  if (type === "BASE_DAMAGE") {
    return { holdMs: 0, lifeMs: PHASE1_TIMING.BASE_DAMAGE_LIFE_MS, flashMs: 220, shakePx: 5.5, shakeMs: 220, recoilPx: 0 };
  }
  if (type === "BOSS_KILL") {
    return { holdMs: PHASE1_TIMING.IMPACT_HOLD_MS, lifeMs: 620, flashMs: 170, shakePx: 3.6, shakeMs: 190, recoilPx: 6.5 };
  }
  if (type === "KILL") {
    return { holdMs: PHASE1_TIMING.IMPACT_HOLD_MS, lifeMs: PHASE1_TIMING.KILL_LIFE_MS, flashMs: 150, shakePx: 3.0, shakeMs: 165, recoilPx: 5.5 };
  }
  return { holdMs: PHASE1_TIMING.IMPACT_HOLD_MS, lifeMs: PHASE1_TIMING.HIT_LIFE_MS, flashMs: PHASE1_TIMING.HIT_FLASH_MS, shakePx: 1.6, shakeMs: 105, recoilPx: 3.5 };
}

export function phase1VisualAgeMs(event, nowMs) {
  const rawAge = Math.max(0, Number(nowMs) - eventObservedAt(event));
  const holdMs = phase1ReactionProfile(event?.type).holdMs;
  return Math.max(0, rawAge - holdMs);
}

export function phase1ActiveEvents(events, nowMs) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    const rawAge = Math.max(0, Number(nowMs) - eventObservedAt(event));
    return rawAge <= phase1ReactionProfile(event?.type).lifeMs + phase1ReactionProfile(event?.type).holdMs;
  });
}

function seededUnit(eventId, index) {
  let value = ((Math.abs(Math.trunc(Number(eventId) || 1)) + 1) * 1103515245 + (index + 11) * 12345) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

export function phase1ShakeOffset(events, nowMs) {
  let best = null;
  let bestScore = 0;
  for (const event of Array.isArray(events) ? events : []) {
    const profile = phase1ReactionProfile(event?.type);
    const age = Math.max(0, Number(nowMs) - eventObservedAt(event));
    if (age > profile.shakeMs || profile.shakePx <= 0) continue;
    const envelope = 1 - age / profile.shakeMs;
    const score = profile.shakePx * envelope;
    if (score > bestScore) {
      best = { event, profile, age, envelope };
      bestScore = score;
    }
  }
  if (!best) return { x: 0, y: 0 };
  const phase = best.age * 0.095 + (Number(best.event.id) || 0) * 1.71;
  const amplitude = best.profile.shakePx * best.envelope;
  return {
    x: Math.sin(phase) * amplitude,
    y: Math.cos(phase * 1.37) * amplitude * 0.62,
  };
}

export function phase1RecoilOffset(events, sourceColumn, nowMs) {
  let recoil = 0;
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type === "BASE_DAMAGE" || Number(event?.sourceColumn) !== Number(sourceColumn)) continue;
    const profile = phase1ReactionProfile(event?.type);
    const age = Math.max(0, Number(nowMs) - eventObservedAt(event));
    if (age > PHASE1_TIMING.RECOIL_MS) continue;
    const envelope = 1 - age / PHASE1_TIMING.RECOIL_MS;
    recoil = Math.max(recoil, profile.recoilPx * Math.sin(envelope * Math.PI * 0.5) * envelope);
  }
  return recoil;
}

function recordPresentationEvent(event, observedAtMs = clockMs()) {
  if (!event || typeof event !== "object") return;
  presentationEvents.push({ ...event, observedAtMs });
  if (presentationEvents.length > MAX_PRESENTATION_EVENTS) {
    presentationEvents.splice(0, presentationEvents.length - MAX_PRESENTATION_EVENTS);
  }
}

function enemyX(enemy) {
  return enemy?.enemyType === "BOSS" ? 0.5 : (Number(enemy?.lane) + 0.5) / 4;
}

function leakingEnemies(beforeEnemies, deltaSeconds) {
  return beforeEnemies.filter((enemy) => {
    const nextProgress = Number(enemy.progress) + Math.max(0, Number(enemy.speed) || 0) * deltaSeconds;
    return nextProgress >= 1;
  });
}

function leakSourceX(enemies) {
  if (!enemies.length) return 0.5;
  let totalWeight = 0;
  let weightedX = 0;
  for (const enemy of enemies) {
    const weight = Math.max(1, Number(enemy.hp) || 1);
    totalWeight += weight;
    weightedX += enemyX(enemy) * weight;
  }
  return totalWeight > 0 ? weightedX / totalWeight : 0.5;
}

function baseDamagePresentationEvent(engine, beforeEnemies, deltaSeconds, damage) {
  const leaked = leakingEnemies(beforeEnemies, deltaSeconds);
  return {
    id: -syntheticEventId++,
    type: "BASE_DAMAGE",
    x: leakSourceX(leaked),
    y: 0.985,
    damage: Math.max(0, Math.trunc(Number(damage) || 0)),
    targetType: "BASE",
    targetMaxHp: Math.max(1, Number(engine.state.maxHp) || 1),
    sourceColumn: null,
    particleBudget: 12,
    contributorCount: leaked.length,
  };
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function phase1Reset() {
  presentationEvents.length = 0;
  syntheticEventId = 1;
  return originalReset.call(this);
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase1Tick(deltaSeconds) {
  const beforeHp = this.state.currentHp;
  const beforeEnemies = this.state.enemies.map((enemy) => ({ ...enemy }));
  const beforeMaxEventId = this.state.vfxEvents.reduce(
    (max, event) => Math.max(max, Number(event.id) || 0),
    0,
  );
  const clampedDelta = Math.max(0, Math.min(0.05, Number(deltaSeconds) || 0));
  const result = originalTick.call(this, deltaSeconds);
  const observedAtMs = clockMs();

  for (const event of this.state.vfxEvents) {
    if ((Number(event.id) || 0) <= beforeMaxEventId) continue;
    recordPresentationEvent(event, observedAtMs);
  }

  const baseDamage = Math.max(0, beforeHp - this.state.currentHp);
  if (baseDamage > 0) {
    recordPresentationEvent(
      baseDamagePresentationEvent(this, beforeEnemies, clampedDelta, baseDamage),
      observedAtMs,
    );
  }

  const active = phase1ActiveEvents(presentationEvents, observedAtMs);
  presentationEvents.splice(0, presentationEvents.length, ...active);
  return result;
};

export function phase1RuntimeEvents() {
  return presentationEvents.map((event) => ({ ...event }));
}

export function resetPhase1RuntimeForTest() {
  presentationEvents.length = 0;
  syntheticEventId = 1;
}

function currentLandscapeHand() {
  if (typeof document === "undefined") return "left";
  return document.getElementById("app")?.classList.contains("handed-right") ? "right" : "left";
}

function eventPoint(event, width, height) {
  const landscape = isLandscapeViewport();
  const logical = logicalPointToScreen(event.x, event.y, landscape, currentLandscapeHand());
  return { x: logical.x * width, y: logical.y * height, landscape };
}

function canvasMetrics(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(0, rect.width);
  const height = Math.max(0, rect.height);
  const dprX = width > 0 ? canvas.width / width : 1;
  const dprY = height > 0 ? canvas.height / height : 1;
  return { rect, width, height, dprX: dprX || 1, dprY: dprY || 1 };
}

function contextOrigin(ctx, metrics) {
  const transform = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!transform) return null;
  return {
    x: transform.e / metrics.dprX,
    y: transform.f / metrics.dprY,
  };
}

function eventMatchesContext(ctx, event, nowMs) {
  if (event?.type !== "HIT" && event?.type !== "KILL") return false;
  const profile = phase1ReactionProfile(event.type);
  const age = Math.max(0, Number(nowMs) - eventObservedAt(event));
  if (age > profile.flashMs) return false;
  const metrics = canvasMetrics(ctx.canvas);
  const origin = contextOrigin(ctx, metrics);
  if (!origin || metrics.width <= 0 || metrics.height <= 0) return false;
  const point = eventPoint(event, metrics.width, metrics.height);
  return Math.hypot(origin.x - point.x, origin.y - point.y) <= 10;
}

function sourceColumnForWeaponContext(ctx) {
  const metrics = canvasMetrics(ctx.canvas);
  const origin = contextOrigin(ctx, metrics);
  if (!origin || metrics.width <= 0 || metrics.height <= 0) return null;
  const landscape = isLandscapeViewport();
  const ratio = landscape ? origin.y / metrics.height : origin.x / metrics.width;
  return Math.max(0, Math.min(3, Math.floor(clamp01(ratio) * 4)));
}

function installSpriteFeedbackPatch() {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  const proto = CanvasRenderingContext2D.prototype;
  if (proto.__phase1DrawImageInstalled) return;
  const originalDrawImage = proto.drawImage;
  Object.defineProperty(proto, "__phase1DrawImageInstalled", { value: true, configurable: false });

  proto.drawImage = function phase1DrawImage(...args) {
    const image = args[0];
    const src = String(image?.currentSrc || image?.src || "");
    const nowMs = clockMs();
    let previousFilter = null;

    if (src.includes("/sprites/enemies/") || src.includes("enemy_normal_atlas") || src.includes("enemy_boss_atlas")) {
      const match = presentationEvents
        .slice()
        .reverse()
        .find((event) => eventMatchesContext(this, event, nowMs));
      if (match && "filter" in this) {
        previousFilter = this.filter;
        const age = Math.max(0, nowMs - eventObservedAt(match));
        const flash = 1 - Math.min(1, age / phase1ReactionProfile(match.type).flashMs);
        this.filter = `brightness(${1.55 + flash * 1.45}) saturate(${0.45 + (1 - flash) * 0.55})`;
      }
    }

    if (src.includes("/sprites/weapons/") && args.length === 9) {
      const column = sourceColumnForWeaponContext(this);
      if (column !== null) args[6] += phase1RecoilOffset(presentationEvents, column, nowMs);
    }

    try {
      return originalDrawImage.apply(this, args);
    } finally {
      if (previousFilter !== null) this.filter = previousFilter;
    }
  };
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const panel = document.getElementById("battle-panel");
  const battlefield = document.getElementById("battlefield");
  if (!panel || !battlefield) return null;
  let overlay = document.getElementById("phase1-vfx-overlay");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "phase1-vfx-overlay";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2",
      transformOrigin: "50% 50%",
      willChange: "transform",
    });
    panel.appendChild(overlay);
  }
  battlefield.style.transformOrigin = "50% 50%";
  battlefield.style.willChange = "transform";
  return { panel, battlefield, overlay };
}

function resizeOverlay(overlay) {
  const rect = overlay.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (overlay.width !== width || overlay.height !== height) {
    overlay.width = width;
    overlay.height = height;
  }
  const ctx = overlay.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawShardBurst(ctx, event, point, ageMs, lifeMs, maxParticles, color) {
  const particleCount = Math.max(0, Math.min(maxParticles, Math.trunc(Number(event.particleBudget) || 0)));
  if (particleCount <= 0) return;
  const progress = clamp01(ageMs / lifeMs);
  const alpha = Math.max(0, 1 - progress);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let index = 0; index < particleCount; index += 1) {
    const jitter = seededUnit(event.id, index) - 0.5;
    const angle = (index / particleCount) * Math.PI * 2 + jitter * 0.7;
    const speed = 14 + seededUnit(event.id + 17, index) * 28;
    const distance = 5 + speed * progress;
    const length = 3 + seededUnit(event.id + 31, index) * 6;
    const x1 = point.x + Math.cos(angle) * distance;
    const y1 = point.y + Math.sin(angle) * distance;
    const x2 = point.x + Math.cos(angle) * (distance + length);
    const y2 = point.y + Math.sin(angle) * (distance + length);
    ctx.strokeStyle = color(alpha * (0.50 + seededUnit(event.id + 47, index) * 0.45));
    ctx.lineWidth = index % 4 === 0 ? 2.2 : 1.3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCombatImpact(ctx, event, width, height, nowMs) {
  if (event.type !== "HIT" && event.type !== "KILL") return;
  const profile = phase1ReactionProfile(event.type);
  const ageMs = phase1VisualAgeMs(event, nowMs);
  const progress = clamp01(ageMs / profile.lifeMs);
  const life = 1 - progress;
  if (life <= 0) return;
  const point = eventPoint(event, width, height);
  const kill = event.type === "KILL";
  const radius = kill ? 15 + 30 * progress : 7 + 15 * progress;
  const flashAge = Math.max(0, nowMs - eventObservedAt(event));
  const flash = Math.max(0, 1 - flashAge / profile.flashMs);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (flash > 0) {
    const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, kill ? 30 : 20);
    gradient.addColorStop(0, `rgba(255,255,255,${0.30 * flash})`);
    gradient.addColorStop(0.35, kill ? `rgba(0,245,255,${0.20 * flash})` : `rgba(255,176,32,${0.18 * flash})`);
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, kill ? 30 : 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = kill ? `rgba(0,245,255,${0.82 * life})` : `rgba(255,176,32,${0.68 * life})`;
  ctx.lineWidth = kill ? 2.6 : 1.6;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  if (kill) {
    drawShardBurst(ctx, event, point, ageMs, profile.lifeMs, 16, (alpha) => `rgba(0,245,255,${alpha})`);
  } else {
    drawShardBurst(ctx, event, point, ageMs, profile.lifeMs, 7, (alpha) => `rgba(255,196,86,${alpha})`);
  }
}

function drawBaseDamage(ctx, event, width, height, nowMs) {
  if (event.type !== "BASE_DAMAGE") return;
  const profile = phase1ReactionProfile(event.type);
  const ageMs = Math.max(0, nowMs - eventObservedAt(event));
  const progress = clamp01(ageMs / profile.lifeMs);
  const life = 1 - progress;
  if (life <= 0) return;
  const point = eventPoint(event, width, height);

  ctx.save();
  ctx.fillStyle = `rgba(255,36,72,${0.14 * life})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255,59,88,${0.92 * life})`;
  ctx.lineWidth = 3 + 5 * life;
  ctx.beginPath();
  if (point.landscape) {
    ctx.moveTo(point.x, 0);
    ctx.lineTo(point.x, height);
  } else {
    ctx.moveTo(0, point.y);
    ctx.lineTo(width, point.y);
  }
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 14 + 36 * progress, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,236,240,${0.95 * life})`;
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(`-${event.damage} HP`, point.x, point.y - 18 - 12 * progress);
  ctx.restore();

  drawShardBurst(ctx, event, point, ageMs, profile.lifeMs, 12, (alpha) => `rgba(255,59,88,${alpha})`);
}

function renderPresentationFrame(nowMs) {
  const surfaces = ensureOverlay();
  if (!surfaces) return;
  const { battlefield, overlay } = surfaces;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);

  const active = phase1ActiveEvents(presentationEvents, nowMs);
  presentationEvents.splice(0, presentationEvents.length, ...active);
  for (const event of active) {
    drawCombatImpact(ctx, event, width, height, nowMs);
    drawBaseDamage(ctx, event, width, height, nowMs);
  }

  const shake = phase1ShakeOffset(active, nowMs);
  const transform = Math.abs(shake.x) + Math.abs(shake.y) > 0.02
    ? `translate3d(${shake.x.toFixed(2)}px, ${shake.y.toFixed(2)}px, 0)`
    : "translate3d(0, 0, 0)";
  battlefield.style.transform = transform;
  overlay.style.transform = transform;
}

function startPresentationLoop() {
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function") return;
  installSpriteFeedbackPatch();
  const frame = (timestamp) => {
    renderPresentationFrame(timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

startPresentationLoop();
