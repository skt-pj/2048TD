import { FEVER_DURATION_SECONDS } from "./combo_fever.js";

export const PHASE4_TIMING = Object.freeze({
  MERGE_LIFE_MS: 520,
  COMBO_LINK_LIFE_MS: 680,
  FEVER_START_LIFE_MS: 820,
  FEVER_START_BOOST_MS: 900,
  MILESTONE_LIFE_MS: 780,
  EVOLUTION_LIFE_MS: 720,
});

export const PHASE4_LIMITS = Object.freeze({
  MERGE_PARTICLES: 7,
  COMBO_PARTICLES: 6,
  FEVER_ACTIVE_STREAKS: 10,
  FEVER_START_STREAKS: 14,
  MILESTONE_RAYS: 10,
});

const WEAPON_RANK = Object.freeze({
  NORMAL: 0,
  RAPID: 1,
  MACHINE_GUN: 2,
  PIERCING: 3,
  EXPLOSIVE: 4,
  LASER: 5,
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function seededUnit(seed, index) {
  let value = ((Math.abs(Math.trunc(Number(seed) || 1)) + 1) * 1103515245 + (index + 29) * 12345) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

function lineIndices(direction, outer) {
  const indices = [];
  for (let inner = 0; inner < 4; inner += 1) {
    if (direction === "LEFT") indices.push(outer * 4 + inner);
    else if (direction === "RIGHT") indices.push(outer * 4 + (3 - inner));
    else if (direction === "UP") indices.push(inner * 4 + outer);
    else if (direction === "DOWN") indices.push((3 - inner) * 4 + outer);
    else throw new Error(`unknown direction: ${direction}`);
  }
  return indices;
}

export function phase4MergeTiles(board, direction) {
  if (!Array.isArray(board) || board.length !== 16) return [];
  const created = [];
  for (let outer = 0; outer < 4; outer += 1) {
    const indices = lineIndices(direction, outer);
    const compact = indices
      .map((logicalIndex) => ({ logicalIndex, value: Number(board[logicalIndex]) || 0 }))
      .filter((cell) => cell.value !== 0);
    let writeIndex = 0;
    for (let i = 0; i < compact.length;) {
      if (i + 1 < compact.length && compact[i].value === compact[i + 1].value) {
        created.push({
          logicalIndex: indices[writeIndex],
          value: compact[i].value * 2,
          sourceLogicalIndices: [compact[i].logicalIndex, compact[i + 1].logicalIndex],
        });
        i += 2;
      } else {
        i += 1;
      }
      writeIndex += 1;
    }
  }
  return created;
}

export function phase4WeaponRank(type) {
  return WEAPON_RANK[String(type || "NORMAL")] ?? 0;
}

export function phase4IsWeaponEvolution(fromType, toType) {
  return phase4WeaponRank(toType) > phase4WeaponRank(fromType);
}

export function phase4IsHighTileMilestone(value) {
  const numeric = Math.trunc(Number(value) || 0);
  return numeric >= 128 && (numeric & (numeric - 1)) === 0;
}

export function phase4EventLifeMs(event) {
  if (event?.type === "MERGE") return PHASE4_TIMING.MERGE_LIFE_MS;
  if (event?.type === "COMBO_LINK") return PHASE4_TIMING.COMBO_LINK_LIFE_MS;
  if (event?.type === "FEVER_START") return PHASE4_TIMING.FEVER_START_LIFE_MS;
  if (event?.type === "TILE_MILESTONE") return PHASE4_TIMING.MILESTONE_LIFE_MS;
  if (event?.type === "WEAPON_EVOLUTION") return PHASE4_TIMING.EVOLUTION_LIFE_MS;
  return 0;
}

export function phase4FeverActiveProfile(remainingSeconds, startAgeMs = Infinity) {
  const ratio = clamp01((Number(remainingSeconds) || 0) / FEVER_DURATION_SECONDS);
  if (ratio <= 0) return { active: false, streakCount: 0, speed: 0, alpha: 0 };
  const introBoost = Number(startAgeMs) >= 0 && Number(startAgeMs) < PHASE4_TIMING.FEVER_START_BOOST_MS;
  return {
    active: true,
    streakCount: introBoost
      ? PHASE4_LIMITS.FEVER_START_STREAKS
      : Math.min(PHASE4_LIMITS.FEVER_ACTIVE_STREAKS, 8 + Math.round(ratio * 2)),
    speed: introBoost ? 3.4 : 2.2 + ratio * 0.45,
    alpha: introBoost ? 0.34 : 0.18 + ratio * 0.07,
  };
}

function strokeLine(ctx, ax, ay, bx, by, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

function quadraticPoint(from, control, to, t) {
  const inv = 1 - t;
  return {
    x: inv * inv * from.x + 2 * inv * t * control.x + t * t * to.x,
    y: inv * inv * from.y + 2 * inv * t * control.y + t * t * to.y,
  };
}

export function drawPhase4Merge(ctx, event, point, ageMs) {
  if (!ctx || event?.type !== "MERGE") return 0;
  const progress = clamp01(Number(ageMs) / PHASE4_TIMING.MERGE_LIFE_MS);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const high = phase4IsHighTileMilestone(event.value);
  const accent = high ? "255,216,77" : (Number(event.logicalIndex) % 2 ? "255,53,211" : "0,245,255");
  const count = Math.min(PHASE4_LIMITS.MERGE_PARTICLES, 4 + Math.max(0, Math.trunc(Number(event.mergeCount) || 0)));
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(${accent},${0.72 * life})`;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 8 + progress * 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${0.16 * life})`;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 16 - progress * 5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < count; i += 1) {
    const angle = i * Math.PI * 2 / Math.max(1, count) + seededUnit(event.id, i) * 0.42;
    const start = 8 + progress * 8;
    const length = 7 + seededUnit(event.id + 41, i) * 13;
    strokeLine(
      ctx,
      point.x + Math.cos(angle) * start,
      point.y + Math.sin(angle) * start,
      point.x + Math.cos(angle) * (start + length),
      point.y + Math.sin(angle) * (start + length),
      i % 3 === 0 ? 2.0 : 1.05,
      `rgba(${accent},${(0.32 + seededUnit(event.id + 73, i) * 0.42) * life})`,
    );
  }
  ctx.translate(point.x, point.y);
  const pop = 1 + Math.sin(Math.min(1, progress * 2) * Math.PI) * 0.18;
  ctx.scale(pop, pop);
  ctx.fillStyle = `rgba(255,255,255,${0.86 * life})`;
  ctx.font = "900 15px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(Math.max(0, Math.trunc(Number(event.value) || 0))), 0, 0);
  ctx.restore();
  return count;
}

export function drawPhase4ComboLink(ctx, event, from, to, ageMs) {
  if (!ctx || event?.type !== "COMBO_LINK" || !from || !to) return 0;
  const progress = clamp01(Number(ageMs) / PHASE4_TIMING.COMBO_LINK_LIFE_MS);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  const control = {
    x: (from.x + to.x) / 2 + (horizontal ? 0 : 26),
    y: (from.y + to.y) / 2 - (horizontal ? 28 : 0),
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(0,245,255,${0.16 * life})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.quadraticCurveTo(control.x, control.y, to.x, to.y);
  ctx.stroke();
  const count = PHASE4_LIMITS.COMBO_PARTICLES;
  for (let i = 0; i < count; i += 1) {
    const t = clamp01(progress * 1.18 - i * 0.10);
    if (t <= 0) continue;
    const point = quadraticPoint(from, control, to, t);
    const alpha = (0.34 + (i % 2) * 0.18) * life;
    ctx.fillStyle = i % 2 ? `rgba(255,53,211,${alpha})` : `rgba(0,245,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(point.x, point.y, i % 3 === 0 ? 2.3 : 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return count;
}

export function drawPhase4FeverStart(ctx, event, rect, ageMs, landscape = false, rightHand = false) {
  if (!ctx || event?.type !== "FEVER_START" || !rect) return false;
  const progress = clamp01(Number(ageMs) / PHASE4_TIMING.FEVER_START_LIFE_MS);
  if (progress >= 1) return false;
  const life = 1 - progress;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  if (ageMs < 180) {
    ctx.fillStyle = `rgba(255,53,211,${0.055 * (1 - clamp01(ageMs / 180))})`;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  for (let lane = 0; lane < 4; lane += 1) {
    const laneCenter = (lane + 0.5) / 4;
    if (landscape) {
      const y = rect.y + laneCenter * rect.height;
      const x = rightHand
        ? rect.x + progress * rect.width
        : rect.x + (1 - progress) * rect.width;
      strokeLine(ctx, x - 26, y, x + 26, y, 3.2, `rgba(${lane % 2 ? "255,53,211" : "0,245,255"},${0.54 * life})`);
    } else {
      const x = rect.x + laneCenter * rect.width;
      const y = rect.y + progress * rect.height;
      strokeLine(ctx, x, y - 26, x, y + 26, 3.2, `rgba(${lane % 2 ? "255,53,211" : "0,245,255"},${0.54 * life})`);
    }
  }
  ctx.strokeStyle = `rgba(255,255,255,${0.28 * life})`;
  ctx.lineWidth = 2;
  ctx.strokeRect(rect.x + 3, rect.y + 3, Math.max(0, rect.width - 6), Math.max(0, rect.height - 6));
  ctx.restore();
  return true;
}

export function drawPhase4FeverActive(ctx, rect, nowMs, profile, landscape = false, rightHand = false) {
  if (!ctx || !rect || !profile?.active || profile.streakCount <= 0) return 0;
  const phase = Math.max(0, Number(nowMs) || 0) / 1000;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < profile.streakCount; i += 1) {
    const lane = i % 4;
    const offset = ((i * 0.173 + phase * profile.speed * 0.16) % 1 + 1) % 1;
    const laneJitter = (seededUnit(i + 17, lane) - 0.5) * 0.12;
    const laneCenter = clamp01((lane + 0.5) / 4 + laneJitter);
    const alpha = profile.alpha * (0.70 + 0.30 * seededUnit(i + 71, lane));
    const color = i % 3 === 0 ? "255,53,211" : i % 3 === 1 ? "0,245,255" : "255,255,255";
    if (landscape) {
      const x = rightHand ? rect.x + offset * rect.width : rect.x + (1 - offset) * rect.width;
      const y = rect.y + laneCenter * rect.height;
      const dir = rightHand ? 1 : -1;
      strokeLine(ctx, x - dir * 14, y, x + dir * 7, y, i % 4 === 0 ? 1.8 : 1.1, `rgba(${color},${alpha})`);
    } else {
      const x = rect.x + laneCenter * rect.width;
      const y = rect.y + offset * rect.height;
      strokeLine(ctx, x, y - 14, x, y + 7, i % 4 === 0 ? 1.8 : 1.1, `rgba(${color},${alpha})`);
    }
  }
  ctx.restore();
  return profile.streakCount;
}

export function drawPhase4Milestone(ctx, event, point, ageMs) {
  if (!ctx || event?.type !== "TILE_MILESTONE") return 0;
  const progress = clamp01(Number(ageMs) / PHASE4_TIMING.MILESTONE_LIFE_MS);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const rays = PHASE4_LIMITS.MILESTONE_RAYS;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255,216,77,${0.88 * life})`;
  ctx.lineWidth = 3.0;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 12 + progress * 38, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < rays; i += 1) {
    const angle = i * Math.PI * 2 / rays + seededUnit(event.id, i) * 0.22;
    const start = 15 + progress * 13;
    const length = 10 + seededUnit(event.id + 91, i) * 18;
    strokeLine(
      ctx,
      point.x + Math.cos(angle) * start,
      point.y + Math.sin(angle) * start,
      point.x + Math.cos(angle) * (start + length),
      point.y + Math.sin(angle) * (start + length),
      i % 3 === 0 ? 2.2 : 1.15,
      `rgba(${i % 2 ? "255,216,77" : "255,255,255"},${0.56 * life})`,
    );
  }
  ctx.restore();
  return rays;
}

export function drawPhase4WeaponEvolution(ctx, event, rect, ageMs) {
  if (!ctx || event?.type !== "WEAPON_EVOLUTION" || !rect) return false;
  const progress = clamp01(Number(ageMs) / PHASE4_TIMING.EVOLUTION_LIFE_MS);
  if (progress >= 1) return false;
  const life = 1 - progress;
  const inset = 2 + progress * 8;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255,216,77,${0.72 * life})`;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(rect.x - inset, rect.y - inset, rect.width + inset * 2, rect.height + inset * 2);
  ctx.fillStyle = `rgba(255,255,255,${0.78 * life})`;
  ctx.font = "900 9px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("EVOLVE", rect.x + rect.width / 2, rect.y - 5 - progress * 5);
  ctx.restore();
  return true;
}
