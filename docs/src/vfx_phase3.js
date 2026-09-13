import { GameEngine } from "./game_engine.js";
import { isLandscapeViewport, logicalPointToScreen } from "./orientation.js";
import {
  PHASE3_TIMING,
  drawPhase3BossAttack,
  drawPhase3BossDeath,
  drawPhase3BossHit,
  drawPhase3BossSpawn,
  drawPhase3BossWarning,
  phase3BossAnimationName,
  phase3BossEventLifeMs,
  phase3BossSpriteFrame,
} from "./vfx_phase3_profiles.js?v=vfx-phase3-1";

const MAX_PHASE3_EVENTS = 24;
let runtimeEvents = [];
let runtimeBosses = [];
let warningRemainingSeconds = null;
let syntheticEventId = 1;

function clockMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function currentLandscapeHand() {
  if (typeof document === "undefined") return "left";
  return document.getElementById("app")?.classList.contains("handed-right") ? "right" : "left";
}

function screenPoint(x, y, width, height) {
  const landscape = isLandscapeViewport();
  const logical = logicalPointToScreen(x, y, landscape, currentLandscapeHand());
  return { x: logical.x * width, y: logical.y * height, landscape };
}

function recordRuntimeEvent(event, observedAtMs) {
  runtimeEvents.push({ ...event, observedAtMs });
  if (runtimeEvents.length > MAX_PHASE3_EVENTS) {
    runtimeEvents.splice(0, runtimeEvents.length - MAX_PHASE3_EVENTS);
  }
}

function pruneRuntimeEvents(nowMs) {
  runtimeEvents = runtimeEvents.filter((event) => {
    const lifeMs = phase3BossEventLifeMs(event);
    return lifeMs > 0 && Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0)) <= lifeMs;
  });
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function phase3Reset() {
  runtimeEvents = [];
  runtimeBosses = [];
  warningRemainingSeconds = null;
  syntheticEventId = 1;
  return originalReset.call(this);
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase3Tick(deltaSeconds) {
  const beforeBossIds = new Set(
    (this.state?.enemies ?? [])
      .filter((enemy) => enemy.enemyType === "BOSS")
      .map((enemy) => enemy.id),
  );
  const beforeMaxVfxId = (this.state?.vfxEvents ?? []).reduce(
    (max, event) => Math.max(max, Number(event.id) || 0),
    0,
  );

  const result = originalTick.call(this, deltaSeconds);
  const observedAtMs = clockMs();

  const bosses = (this.state?.enemies ?? []).filter((enemy) => enemy.enemyType === "BOSS");
  for (const boss of bosses) {
    if (beforeBossIds.has(boss.id)) continue;
    recordRuntimeEvent({
      id: -300000 - syntheticEventId++,
      type: "BOSS_SPAWN",
      x: 0.5,
      y: Math.max(0.055, Number(boss.progress) || 0),
      targetId: boss.id,
      targetType: "BOSS",
      particleBudget: 14,
    }, observedAtMs);
  }

  for (const event of this.state?.vfxEvents ?? []) {
    if ((Number(event.id) || 0) <= beforeMaxVfxId) continue;
    if (event.targetType !== "BOSS") continue;
    if (event.type !== "HIT" && event.type !== "BOSS_KILL") continue;
    recordRuntimeEvent(event, observedAtMs);
  }

  runtimeBosses = bosses.map((boss) => ({ ...boss }));
  warningRemainingSeconds = this.state?.bossWarning
    ? Math.max(0, Number(this.state.bossWarning.remainingSeconds) || 0)
    : null;
  pruneRuntimeEvents(observedAtMs);
  return result;
};

export function phase3RuntimeSnapshot() {
  return {
    events: runtimeEvents.map((event) => ({ ...event })),
    bosses: runtimeBosses.map((boss) => ({ ...boss })),
    warningRemainingSeconds,
  };
}

export function resetPhase3RuntimeForTest() {
  runtimeEvents = [];
  runtimeBosses = [];
  warningRemainingSeconds = null;
  syntheticEventId = 1;
}

function canvasMetrics(ctx) {
  const canvas = ctx?.canvas;
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") return null;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(0, Number(rect.width) || 0);
  const height = Math.max(0, Number(rect.height) || 0);
  if (width <= 0 || height <= 0) return null;
  return {
    width,
    height,
    dprX: canvas.width / width || 1,
    dprY: canvas.height / height || 1,
  };
}

function contextOrigin(ctx, metrics) {
  if (!ctx || typeof ctx.getTransform !== "function") return null;
  const transform = ctx.getTransform();
  if (!transform) return null;
  return {
    x: transform.e / metrics.dprX,
    y: transform.f / metrics.dprY,
  };
}

function bossForContext(ctx) {
  const metrics = canvasMetrics(ctx);
  if (!metrics) return null;
  const origin = contextOrigin(ctx, metrics);
  if (!origin) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const boss of runtimeBosses) {
    const point = screenPoint(0.5, boss.progress, metrics.width, metrics.height);
    const distance = Math.hypot(origin.x - point.x, origin.y - point.y);
    if (distance < bestDistance) {
      best = boss;
      bestDistance = distance;
    }
  }
  return bestDistance <= 20 ? best : null;
}

function installBossSpriteStatePatch() {
  if (typeof CanvasRenderingContext2D === "undefined") return;
  const proto = CanvasRenderingContext2D.prototype;
  if (proto.__phase3BossSpriteInstalled) return;
  const previousDrawImage = proto.drawImage;
  Object.defineProperty(proto, "__phase3BossSpriteInstalled", { value: true, configurable: false });

  proto.drawImage = function phase3BossDrawImage(...args) {
    const image = args[0];
    const src = String(image?.currentSrc || image?.src || "");
    if (src.includes("enemy_boss_atlas") && args.length === 9) {
      const sourceSize = Number(args[3]);
      const sourceY = Number(args[2]);
      const row = sourceSize > 0 ? Math.round(sourceY / sourceSize) : -1;
      const isHitOrDeathRow = row === 3 || row === 4 || row === 8 || row === 9;
      if (!isHitOrDeathRow && sourceSize === 128) {
        const boss = bossForContext(this);
        if (boss) {
          const animationName = phase3BossAnimationName(boss);
          if (animationName === "idle" || animationName === "attack") {
            const frame = phase3BossSpriteFrame(
              boss.id,
              animationName,
              clockMs() / 1000 + Number(boss.id) * 0.071,
            );
            if (frame) {
              args[1] = frame.frame * sourceSize;
              args[2] = frame.row * sourceSize;
            }
          }
        }
      }
    }
    return previousDrawImage.apply(this, args);
  };
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const panel = document.getElementById("battle-panel");
  const battlefield = document.getElementById("battlefield");
  if (!panel || !battlefield) return null;
  let overlay = document.getElementById("phase3-vfx-overlay");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "phase3-vfx-overlay";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "4",
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

function renderWarning(ctx, width, height) {
  if (warningRemainingSeconds === null) return;
  if (warningRemainingSeconds > PHASE3_TIMING.WARNING_CONVERGE_SECONDS) return;
  const entry = screenPoint(0.5, 0.055, width, height);
  drawPhase3BossWarning(ctx, entry, warningRemainingSeconds);
}

function renderBossStates(ctx, width, height, nowMs) {
  const defense = screenPoint(0.5, 0.985, width, height);
  for (const boss of runtimeBosses) {
    const point = screenPoint(0.5, boss.progress, width, height);
    drawPhase3BossAttack(ctx, boss, point, defense, nowMs);
  }
}

function renderBossEvents(ctx, width, height, nowMs) {
  for (const event of runtimeEvents) {
    const ageMs = Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0));
    const point = screenPoint(event.x, event.y, width, height);
    if (event.type === "BOSS_SPAWN") {
      drawPhase3BossSpawn(ctx, event, point, ageMs, width, height);
    } else if (event.type === "HIT" && event.targetType === "BOSS") {
      drawPhase3BossHit(ctx, event, point, ageMs);
    } else if (event.type === "BOSS_KILL") {
      drawPhase3BossDeath(ctx, event, point, ageMs, width, height);
    }
  }
}

function renderPhase3Frame(nowMs) {
  const surfaces = ensureOverlay();
  if (!surfaces) return;
  const { battlefield, overlay } = surfaces;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);
  renderWarning(ctx, width, height);
  renderBossStates(ctx, width, height, nowMs);
  renderBossEvents(ctx, width, height, nowMs);
  overlay.style.transform = battlefield.style.transform || "translate3d(0, 0, 0)";
}

function startPhase3Loop() {
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function") return;
  const frame = (timestamp) => {
    renderPhase3Frame(timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

installBossSpriteStatePatch();
startPhase3Loop();
