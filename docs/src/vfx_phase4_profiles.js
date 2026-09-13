import { GRID_SIZE, cellIndex } from "./game_rules.js";
import { FEVER_DURATION_SECONDS } from "./combo_fever.js";
import { columnLevel, weaponType } from "./column_combat_rules.js";

export const PHASE4_TIMING = Object.freeze({
  MERGE_LIFE_MS: 520,
  COMBO_STREAM_LIFE_MS: 680,
  FEVER_START_LIFE_MS: 760,
  MILESTONE_LIFE_MS: 820,
});

export const PHASE4_LIMITS = Object.freeze({
  MAX_EVENTS: 24,
  MERGE_PARTICLES: 8,
  COMBO_PARTICLES_PER_SOURCE: 5,
  FEVER_TRAILS_MAX: 14,
  MILESTONE_RAYS: 12,
});

const WEAPON_ORDER = Object.freeze({
  NORMAL: 0,
  RAPID: 1,
  MACHINE_GUN: 2,
  PIERCING: 3,
  EXPLOSIVE: 4,
  LASER: 5,
});

function movementIndices(outer, direction) {
  const indices = [];
  for (let inner = 0; inner < GRID_SIZE; inner += 1) {
    if (direction === "LEFT") indices.push(cellIndex(outer, inner));
    else if (direction === "RIGHT") indices.push(cellIndex(outer, GRID_SIZE - 1 - inner));
    else if (direction === "UP") indices.push(cellIndex(inner, outer));
    else if (direction === "DOWN") indices.push(cellIndex(GRID_SIZE - 1 - inner, outer));
    else throw new Error(`unknown direction: ${direction}`);
  }
  return indices;
}

export function phase4MergeDestinations(board, direction) {
  if (!Array.isArray(board) || board.length !== GRID_SIZE * GRID_SIZE) return [];
  const events = [];
  for (let outer = 0; outer < GRID_SIZE; outer += 1) {
    const indices = movementIndices(outer, direction);
    const compact = indices.map((index) => Number(board[index]) || 0).filter((value) => value !== 0);
    let outputIndex = 0;
    for (let inputIndex = 0; inputIndex < compact.length;) {
      if (inputIndex + 1 < compact.length && compact[inputIndex] === compact[inputIndex + 1]) {
        events.push({
          logicalIndex: indices[outputIndex],
          value: compact[inputIndex] * 2,
        });
        inputIndex += 2;
      } else {
        inputIndex += 1;
      }
      outputIndex += 1;
    }
  }
  return events;
}

export function phase4HighTileMilestones(mergeEvents) {
  return (Array.isArray(mergeEvents) ? mergeEvents : [])
    .filter((event) => Number(event?.value) >= 128)
    .map((event) => ({ logicalIndex: Number(event.logicalIndex), value: Number(event.value) }));
}

export function phase4WeaponEvolutions(beforeBoard, afterBoard) {
  if (!Array.isArray(beforeBoard) || beforeBoard.length !== GRID_SIZE * GRID_SIZE) return [];
  if (!Array.isArray(afterBoard) || afterBoard.length !== GRID_SIZE * GRID_SIZE) return [];
  const evolutions = [];
  for (let column = 0; column < GRID_SIZE; column += 1) {
    const beforeType = weaponType(columnLevel(beforeBoard, column));
    const afterType = weaponType(columnLevel(afterBoard, column));
    if ((WEAPON_ORDER[afterType] ?? 0) <= (WEAPON_ORDER[beforeType] ?? 0)) continue;
    evolutions.push({ column, beforeType, afterType });
  }
  return evolutions;
}

export function phase4FeverStage(remainingSeconds) {
  const remaining = Math.max(0, Math.min(FEVER_DURATION_SECONDS, Number(remainingSeconds) || 0));
  if (remaining <= 0) return 0;
  const elapsedRatio = 1 - remaining / FEVER_DURATION_SECONDS;
  if (elapsedRatio < 1 / 3) return 1;
  if (elapsedRatio < 2 / 3) return 2;
  return 3;
}

export function phase4FeverProfile(remainingSeconds) {
  const stage = phase4FeverStage(remainingSeconds);
  return {
    stage,
    trailCount: [0, 6, 10, PHASE4_LIMITS.FEVER_TRAILS_MAX][stage],
    speed: [0, 0.62, 0.92, 1.22][stage],
    trailLength: [0, 14, 20, 26][stage],
    alpha: [0, 0.16, 0.20, 0.24][stage],
  };
}

export function phase4EventLifeMs(event) {
  if (event?.type === "MERGE") return PHASE4_TIMING.MERGE_LIFE_MS;
  if (event?.type === "COMBO_STREAM") return PHASE4_TIMING.COMBO_STREAM_LIFE_MS;
  if (event?.type === "FEVER_START") return PHASE4_TIMING.FEVER_START_LIFE_MS;
  if (event?.type === "MILESTONE") return PHASE4_TIMING.MILESTONE_LIFE_MS;
  return 0;
}

function easeOutCubic(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return 1 - (1 - t) ** 3;
}

export function drawPhase4Merge(ctx, point, value, ageMs) {
  const progress = Math.max(0, Math.min(1, ageMs / PHASE4_TIMING.MERGE_LIFE_MS));
  const life = 1 - progress;
  if (life <= 0) return;
  const radius = 10 + 28 * easeOutCubic(progress);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(0,245,255,${0.8 * life})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < PHASE4_LIMITS.MERGE_PARTICLES; i += 1) {
    const angle = i * Math.PI * 2 / PHASE4_LIMITS.MERGE_PARTICLES + progress * 0.45;
    const distance = 8 + progress * (22 + (i % 3) * 4);
    ctx.fillStyle = i % 2 === 0
      ? `rgba(255,53,211,${0.72 * life})`
      : `rgba(0,245,255,${0.72 * life})`;
    ctx.beginPath();
    ctx.arc(point.x + Math.cos(angle) * distance, point.y + Math.sin(angle) * distance, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, life * 1.35)})`;
  ctx.font = `900 ${Math.round(18 + 7 * life)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(value), point.x, point.y);
  ctx.restore();
}

export function drawPhase4ComboStream(ctx, sources, target, ageMs) {
  const progress = Math.max(0, Math.min(1, ageMs / PHASE4_TIMING.COMBO_STREAM_LIFE_MS));
  const life = 1 - progress;
  if (life <= 0 || !target) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const source of sources.slice(0, 4)) {
    const control = {
      x: (source.x + target.x) / 2,
      y: Math.min(source.y, target.y) - 34,
    };
    for (let i = 0; i < PHASE4_LIMITS.COMBO_PARTICLES_PER_SOURCE; i += 1) {
      const t = Math.max(0, Math.min(1, progress * 1.18 - i * 0.085));
      if (t <= 0) continue;
      const inv = 1 - t;
      const x = inv * inv * source.x + 2 * inv * t * control.x + t * t * target.x;
      const y = inv * inv * source.y + 2 * inv * t * control.y + t * t * target.y;
      ctx.fillStyle = i % 2 === 0
        ? `rgba(0,245,255,${0.72 * life})`
        : `rgba(255,53,211,${0.70 * life})`;
      ctx.beginPath();
      ctx.arc(x, y, 2.5 - i * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawPhase4FeverStart(ctx, rect, ageMs, landscape, rightHand) {
  const progress = Math.max(0, Math.min(1, ageMs / PHASE4_TIMING.FEVER_START_LIFE_MS));
  const life = 1 - progress;
  if (life <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 4;
  for (let lane = 0; lane < GRID_SIZE; lane += 1) {
    const laneRatio = (lane + 0.5) / GRID_SIZE;
    const laneColor = lane % 2 === 0 ? "255,53,211" : "0,245,255";
    ctx.strokeStyle = `rgba(${laneColor},${0.72 * life})`;
    ctx.beginPath();
    if (!landscape) {
      const x = rect.x + laneRatio * rect.width;
      const y = rect.y + rect.height * (1 - progress);
      ctx.moveTo(x - rect.width * 0.085, y);
      ctx.lineTo(x + rect.width * 0.085, y);
    } else {
      const y = rect.y + laneRatio * rect.height;
      const x = rect.x + rect.width * (rightHand ? 1 - progress : progress);
      ctx.moveTo(x, y - rect.height * 0.085);
      ctx.lineTo(x, y + rect.height * 0.085);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(255,255,255,${0.46 * life})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 2, rect.y + 2, Math.max(0, rect.width - 4), Math.max(0, rect.height - 4));
  ctx.restore();
}

export function drawPhase4FeverActive(ctx, rect, nowMs, remainingSeconds, landscape, rightHand) {
  const profile = phase4FeverProfile(remainingSeconds);
  if (profile.stage <= 0) return;
  const phase = Number(nowMs) / 1000;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < profile.trailCount; i += 1) {
    const lane = i % GRID_SIZE;
    const laneOffset = ((i * 0.317) % 0.64) + 0.18;
    const travel = (phase * profile.speed + i * 0.137) % 1;
    ctx.strokeStyle = i % 3 === 0
      ? `rgba(255,53,211,${profile.alpha})`
      : i % 3 === 1
        ? `rgba(0,245,255,${profile.alpha})`
        : `rgba(255,255,255,${profile.alpha * 0.9})`;
    ctx.beginPath();
    if (!landscape) {
      const x = rect.x + (lane + laneOffset) * rect.width / GRID_SIZE;
      const y = rect.y + travel * rect.height;
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.max(rect.y, y - profile.trailLength));
    } else {
      const y = rect.y + (lane + laneOffset) * rect.height / GRID_SIZE;
      const xTravel = rightHand ? travel : 1 - travel;
      const x = rect.x + xTravel * rect.width;
      const direction = rightHand ? -1 : 1;
      ctx.moveTo(x, y);
      ctx.lineTo(Math.max(rect.x, Math.min(rect.x + rect.width, x + direction * profile.trailLength)), y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPhase4Milestone(ctx, tilePoints, weaponPoints, ageMs) {
  const progress = Math.max(0, Math.min(1, ageMs / PHASE4_TIMING.MILESTONE_LIFE_MS));
  const life = 1 - progress;
  if (life <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const point of tilePoints) {
    const radius = 16 + progress * 36;
    ctx.strokeStyle = `rgba(255,202,76,${0.88 * life})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < PHASE4_LIMITS.MILESTONE_RAYS; i += 1) {
      const angle = i * Math.PI * 2 / PHASE4_LIMITS.MILESTONE_RAYS;
      const inner = radius * 0.58;
      const outer = radius * (0.9 + (i % 2) * 0.16);
      ctx.beginPath();
      ctx.moveTo(point.x + Math.cos(angle) * inner, point.y + Math.sin(angle) * inner);
      ctx.lineTo(point.x + Math.cos(angle) * outer, point.y + Math.sin(angle) * outer);
      ctx.stroke();
    }
  }
  for (const point of weaponPoints) {
    const radius = 18 + progress * 24;
    ctx.strokeStyle = `rgba(0,245,255,${0.70 * life})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,202,76,${0.18 * life})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(3, radius * 0.62), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
