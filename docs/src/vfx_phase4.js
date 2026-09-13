import { GameEngine } from "./game_engine.js";
import { columnLevel, weaponType } from "./column_combat_rules.js";
import { feverActive } from "./combo_fever.js";
import {
  drawPhase4ComboLink,
  drawPhase4FeverActive,
  drawPhase4FeverStart,
  drawPhase4Merge,
  drawPhase4Milestone,
  drawPhase4WeaponEvolution,
  phase4EventLifeMs,
  phase4FeverActiveProfile,
  phase4IsHighTileMilestone,
  phase4IsWeaponEvolution,
  phase4MergeTiles,
} from "./vfx_phase4_profiles.js?v=vfx-phase4-1";

const MAX_PHASE4_EVENTS = 48;
let runtimeEvents = [];
let runtimeFeverActive = false;
let runtimeFeverRemainingSeconds = 0;
let syntheticEventId = 1;

function clockMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") return performance.now();
  return Date.now();
}

function nextSyntheticId() {
  return -400000 - syntheticEventId++;
}

function recordRuntimeEvent(event, observedAtMs) {
  runtimeEvents.push({ ...event, observedAtMs });
  if (runtimeEvents.length > MAX_PHASE4_EVENTS) {
    runtimeEvents.splice(0, runtimeEvents.length - MAX_PHASE4_EVENTS);
  }
}

function pruneRuntimeEvents(nowMs) {
  runtimeEvents = runtimeEvents.filter((event) => {
    const lifeMs = phase4EventLifeMs(event);
    return lifeMs > 0 && Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0)) <= lifeMs;
  });
}

function boardWeaponTypes(board) {
  return [0, 1, 2, 3].map((column) => weaponType(columnLevel(board, column)));
}

function syncFeverState(engine) {
  runtimeFeverActive = feverActive(engine?.state?.comboFever);
  runtimeFeverRemainingSeconds = Math.max(0, Number(engine?.state?.comboFever?.feverRemainingSeconds) || 0);
}

const originalReset = GameEngine.prototype.reset;
GameEngine.prototype.reset = function phase4Reset() {
  runtimeEvents = [];
  runtimeFeverActive = false;
  runtimeFeverRemainingSeconds = 0;
  syntheticEventId = 1;
  return originalReset.call(this);
};

const originalMove = GameEngine.prototype.move;
GameEngine.prototype.move = function phase4Move(direction) {
  const beforeBoard = Array.isArray(this.state?.board) ? this.state.board.slice() : [];
  const beforeTypes = beforeBoard.length === 16 ? boardWeaponTypes(beforeBoard) : [];
  const beforeFeverCount = Math.max(0, Number(this.state?.comboFever?.feverCount) || 0);
  const result = originalMove.call(this, direction);
  const observedAtMs = clockMs();

  if (result?.changed && beforeBoard.length === 16) {
    const mergeTiles = phase4MergeTiles(beforeBoard, direction);
    const mergeCount = Math.max(0, Math.trunc(Number(result.mergeCount) || 0));
    const mergeBurst = Math.max(0, Math.trunc(Number(this.state?.mergeBurst) || 0));
    const mergePeak = Math.max(0, Math.trunc(Number(this.state?.mergePeak) || 0));
    const combo = Math.max(0, Math.trunc(Number(this.state?.comboFever?.combo) || 0));
    const comboEventId = Math.max(0, Math.trunc(Number(this.state?.comboFever?.comboEventId) || 0));

    for (const tile of mergeTiles) {
      recordRuntimeEvent({
        id: nextSyntheticId(),
        type: "MERGE",
        logicalIndex: tile.logicalIndex,
        value: tile.value,
        sourceLogicalIndices: tile.sourceLogicalIndices.slice(),
        mergeCount,
        mergeBurst,
        mergePeak,
        combo,
        comboEventId,
      }, observedAtMs);

      if (phase4IsHighTileMilestone(tile.value)) {
        recordRuntimeEvent({
          id: nextSyntheticId(),
          type: "TILE_MILESTONE",
          logicalIndex: tile.logicalIndex,
          value: tile.value,
          comboEventId,
        }, observedAtMs);
      }
    }

    if (mergeTiles.length > 0 && combo > 0) {
      const anchor = mergeTiles.reduce((best, tile) => (!best || tile.value > best.value ? tile : best), null);
      recordRuntimeEvent({
        id: nextSyntheticId(),
        type: "COMBO_LINK",
        logicalIndex: anchor.logicalIndex,
        value: anchor.value,
        combo,
        comboEventId,
        mergeBurst,
        mergePeak,
      }, observedAtMs);
    }

    const afterFeverCount = Math.max(0, Number(this.state?.comboFever?.feverCount) || 0);
    if (afterFeverCount > beforeFeverCount) {
      recordRuntimeEvent({
        id: nextSyntheticId(),
        type: "FEVER_START",
        feverCount: afterFeverCount,
        comboEventId,
        mergeBurst,
        mergePeak,
      }, observedAtMs);
    }

    const afterTypes = boardWeaponTypes(this.state.board);
    for (let column = 0; column < 4; column += 1) {
      const fromType = beforeTypes[column];
      const toType = afterTypes[column];
      if (!phase4IsWeaponEvolution(fromType, toType)) continue;
      recordRuntimeEvent({
        id: nextSyntheticId(),
        type: "WEAPON_EVOLUTION",
        column,
        fromType,
        toType,
        comboEventId,
      }, observedAtMs);
    }
  }

  syncFeverState(this);
  pruneRuntimeEvents(observedAtMs);
  return result;
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function phase4Tick(deltaSeconds) {
  const result = originalTick.call(this, deltaSeconds);
  const observedAtMs = clockMs();
  syncFeverState(this);
  pruneRuntimeEvents(observedAtMs);
  return result;
};

export function phase4RuntimeSnapshot() {
  return {
    events: runtimeEvents.map((event) => ({ ...event })),
    feverActive: runtimeFeverActive,
    feverRemainingSeconds: runtimeFeverRemainingSeconds,
  };
}

export function resetPhase4RuntimeForTest() {
  runtimeEvents = [];
  runtimeFeverActive = false;
  runtimeFeverRemainingSeconds = 0;
  syntheticEventId = 1;
}

function ensureOverlay() {
  if (typeof document === "undefined" || !document.body) return null;
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
      zIndex: "12",
    });
    document.body.appendChild(overlay);
  }
  return overlay;
}

function resizeOverlay(overlay) {
  const width = Math.max(1, Number(globalThis.innerWidth) || document.documentElement.clientWidth || 1);
  const height = Math.max(1, Number(globalThis.innerHeight) || document.documentElement.clientHeight || 1);
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

function rectOf(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function tilePoint(logicalIndex) {
  const board = document.getElementById("board");
  const tile = board?.querySelector(`[data-logical-index="${Number(logicalIndex)}"]`);
  return centerOf(tile);
}

function weaponRect(column) {
  const strip = document.getElementById("weapon-strip");
  const card = strip?.querySelector(`.weapon-card[data-lane="${Number(column)}"]`);
  return rectOf(card);
}

function feverStartAgeMs(nowMs) {
  let newest = Infinity;
  for (const event of runtimeEvents) {
    if (event.type !== "FEVER_START") continue;
    newest = Math.min(newest, Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0)));
  }
  return newest;
}

function renderPhase4Frame(nowMs) {
  if (typeof document === "undefined") return;
  const overlay = ensureOverlay();
  if (!overlay) return;
  const { ctx, width, height } = resizeOverlay(overlay);
  ctx.clearRect(0, 0, width, height);

  const app = document.getElementById("app");
  const battleRect = rectOf(document.getElementById("battle-panel"));
  const landscape = Boolean(app?.classList.contains("landscape-layout"));
  const rightHand = Boolean(app?.classList.contains("handed-right"));

  if (runtimeFeverActive && battleRect) {
    const profile = phase4FeverActiveProfile(runtimeFeverRemainingSeconds, feverStartAgeMs(nowMs));
    drawPhase4FeverActive(ctx, battleRect, nowMs, profile, landscape, rightHand);
  }

  for (const event of runtimeEvents) {
    const ageMs = Math.max(0, Number(nowMs) - Number(event.observedAtMs || 0));
    if (event.type === "FEVER_START" && battleRect) {
      drawPhase4FeverStart(ctx, event, battleRect, ageMs, landscape, rightHand);
      continue;
    }
    if (event.type === "WEAPON_EVOLUTION") {
      drawPhase4WeaponEvolution(ctx, event, weaponRect(event.column), ageMs);
      continue;
    }
    const point = tilePoint(event.logicalIndex);
    if (!point) continue;
    if (event.type === "MERGE") {
      drawPhase4Merge(ctx, event, point, ageMs);
    } else if (event.type === "TILE_MILESTONE") {
      drawPhase4Milestone(ctx, event, point, ageMs);
    } else if (event.type === "COMBO_LINK") {
      const comboTarget = centerOf(document.getElementById("combo-hud"));
      if (comboTarget) drawPhase4ComboLink(ctx, event, point, comboTarget, ageMs);
    }
  }
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
