import { GameEngine } from "./game_engine.js";
import { FEVER_DURATION_SECONDS } from "./combo_fever.js";
import {
  PHASE4_LIMITS,
  drawPhase4ComboStream,
  drawPhase4FeverActive,
  drawPhase4FeverStart,
  drawPhase4Merge,
  drawPhase4Milestone,
  phase4EventLifeMs,
  phase4HighTileMilestones,
  phase4MergeDestinations,
  phase4WeaponEvolutions,
} from "./vfx_phase4_profiles.js?v=vfx-phase4-1";

let runtimeEvents = [];
let runtimeFeverRemainingSeconds = 0;
let syntheticEventId = 1;

function clockMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function recordRuntimeEvent(event, observedAtMs) {
  runtimeEvents.push({ ...event, observedAtMs });
  if (runtimeEvents.length > PHASE4_LIMITS.MAX_EVENTS) {
    runtimeEvents.splice(0, runtimeEvents.length - PHASE4_LIMITS.MAX_EVENTS);
  }
}

function pruneRuntimeEvents(nowMs) {
  runtimeEvents = runtimeEvents.filter((event) => {
    const lifeMs = phase4EventLifeMs(event);
    return lifeMs > 0 && Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0)) <= lifeMs;
  });
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function phase4Reset() {
  const result = originalReset.call(this);
  runtimeEvents = [];
  runtimeFeverRemainingSeconds = Number(this.state?.comboFever?.feverRemainingSeconds) || 0;
  syntheticEventId = 1;
  return result;
};

const originalMove = GameEngine.prototype.move;
GameEngine.prototype.move = function phase4Move(direction) {
  const beforeBoard = Array.isArray(this.state?.board) ? this.state.board.slice() : [];
  const beforeFeverCount = Number(this.state?.comboFever?.feverCount) || 0;
  const mergeEvents = phase4MergeDestinations(beforeBoard, direction);
  const result = originalMove.call(this, direction);
  if (!result?.changed) return result;

  const observedAtMs = clockMs();
  const acceptedMerges = mergeEvents.slice(0, Math.max(0, Number(result.mergeCount) || 0));
  for (const merge of acceptedMerges) {
    recordRuntimeEvent({
      id: -400000 - syntheticEventId++,
      type: "MERGE",
      logicalIndex: merge.logicalIndex,
      value: merge.value,
    }, observedAtMs);
  }

  if (acceptedMerges.length > 0) {
    recordRuntimeEvent({
      id: -410000 - syntheticEventId++,
      type: "COMBO_STREAM",
      logicalIndices: acceptedMerges.map((merge) => merge.logicalIndex),
      combo: Number(this.state?.comboFever?.combo) || acceptedMerges.length,
    }, observedAtMs);
  }

  const highTiles = phase4HighTileMilestones(acceptedMerges);
  const evolutions = phase4WeaponEvolutions(beforeBoard, this.state?.board ?? []);
  if (highTiles.length > 0 || evolutions.length > 0) {
    recordRuntimeEvent({
      id: -420000 - syntheticEventId++,
      type: "MILESTONE",
      highTiles,
      evolutions,
    }, observedAtMs);
  }

  const feverCount = Number(this.state?.comboFever?.feverCount) || 0;
  if (feverCount > beforeFeverCount) {
    recordRuntimeEvent({
      id: -430000 - syntheticEventId++,
      type: "FEVER_START",
      feverCount,
    }, observedAtMs);
  }

  runtimeFeverRemainingSeconds = Number(this.state?.comboFever?.feverRemainingSeconds) || 0;
  pruneRuntimeEvents(observedAtMs);
  return result;
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase4Tick(deltaSeconds) {
  const result = originalTick.call(this, deltaSeconds);
  runtimeFeverRemainingSeconds = Number(this.state?.comboFever?.feverRemainingSeconds) || 0;
  pruneRuntimeEvents(clockMs());
  return result;
};

export function phase4RuntimeSnapshot() {
  return {
    events: runtimeEvents.map((event) => structuredClone(event)),
    feverRemainingSeconds: runtimeFeverRemainingSeconds,
  };
}

export function resetPhase4RuntimeForTest() {
  runtimeEvents = [];
  runtimeFeverRemainingSeconds = 0;
  syntheticEventId = 1;
}

function ensureOverlay() {
  if (typeof document === "undefined") return null;
  const app = document.getElementById("app");
  if (!app) return null;
  let overlay = document.getElementById("phase4-vfx-overlay");
  if (!overlay) {
    overlay = document.createElement("canvas");
    overlay.id = "phase4-vfx-overlay";
    overlay.setAttribute("aria-hidden", "true");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "8",
    });
    app.appendChild(overlay);
  }
  return overlay;
}

function resizeOverlay(overlay) {
  const width = Math.max(1, Number(globalThis.innerWidth) || overlay.clientWidth || 1);
  const height = Math.max(1, Number(globalThis.innerHeight) || overlay.clientHeight || 1);
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const widthPx = Math.max(1, Math.round(width * dpr));
  const heightPx = Math.max(1, Math.round(height * dpr));
  if (overlay.width !== widthPx || overlay.height !== heightPx) {
    overlay.width = widthPx;
    overlay.height = heightPx;
  }
  const ctx = overlay.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function centerOf(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function tilePoint(logicalIndex) {
  if (typeof document === "undefined") return null;
  return centerOf(document.querySelector(`#board .tile[data-logical-index="${Number(logicalIndex)}"]`));
}

function weaponPoint(column) {
  if (typeof document === "undefined") return null;
  return centerOf(document.querySelector(`#weapon-strip .weapon-card[data-lane="${Number(column)}"]`));
}

function battlefieldRect() {
  if (typeof document === "undefined") return null;
  const canvas = document.getElementById("battlefield");
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") return null;
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function landscapeState() {
  const landscape = Number(globalThis.innerWidth) > Number(globalThis.innerHeight);
  const rightHand = typeof document !== "undefined"
    && document.getElementById("app")?.classList.contains("handed-right");
  return { landscape, rightHand };
}

function renderPhase4Events(ctx, nowMs) {
  for (const event of runtimeEvents) {
    const ageMs = Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0));
    if (event.type === "MERGE") {
      const point = tilePoint(event.logicalIndex);
      if (point) drawPhase4Merge(ctx, point, event.value, ageMs);
    } else if (event.type === "COMBO_STREAM") {
      const sources = event.logicalIndices.map(tilePoint).filter(Boolean);
      const target = centerOf(document.getElementById("combo-hud"));
      if (sources.length > 0 && target) drawPhase4ComboStream(ctx, sources, target, ageMs);
    } else if (event.type === "FEVER_START") {
      const rect = battlefieldRect();
      if (!rect) continue;
      const { landscape, rightHand } = landscapeState();
      drawPhase4FeverStart(ctx, rect, ageMs, landscape, rightHand);
    } else if (event.type === "MILESTONE") {
      const tilePoints = event.highTiles.map((tile) => tilePoint(tile.logicalIndex)).filter(Boolean);
      const weaponPoints = event.evolutions.map((evolution) => weaponPoint(evolution.column)).filter(Boolean);
      if (tilePoints.length > 0 || weaponPoints.length > 0) {
        drawPhase4Milestone(ctx, tilePoints, weaponPoints, ageMs);
      }
    }
  }
}

function renderPhase4Fever(ctx, nowMs) {
  if (runtimeFeverRemainingSeconds <= 0 || runtimeFeverRemainingSeconds > FEVER_DURATION_SECONDS) return;
  const rect = battlefieldRect();
  if (!rect) return;
  const { landscape, rightHand } = landscapeState();
  drawPhase4FeverActive(ctx, rect, nowMs, runtimeFeverRemainingSeconds, landscape, rightHand);
}

function renderPhase4Frame(nowMs) {
  const overlay = ensureOverlay();
  if (!overlay) return;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);
  pruneRuntimeEvents(nowMs);
  renderPhase4Fever(ctx, nowMs);
  renderPhase4Events(ctx, nowMs);
}

function startPhase4Loop() {
  if (typeof document === "undefined" || typeof requestAnimationFrame !== "function") return;
  const frame = (timestamp) => {
    renderPhase4Frame(timestamp);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

startPhase4Loop();
