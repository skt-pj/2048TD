export const PHASE3_BOSS_PROGRESS = Object.freeze({
  IDLE_END: 0.10,
  ATTACK_PREP: 0.74,
  ATTACK: 0.82,
});

export const PHASE3_TIMING = Object.freeze({
  WARNING_CONVERGE_SECONDS: 1.15,
  SPAWN_LIFE_MS: 820,
  HIT_LIFE_MS: 460,
  DEATH_LIFE_MS: 980,
});

const BOSS_ANIMATIONS = Object.freeze({
  B01: Object.freeze({
    idle: Object.freeze({ row: 0, frames: 6, fps: 6 }),
    move: Object.freeze({ row: 1, frames: 8, fps: 8 }),
    attack: Object.freeze({ row: 2, frames: 8, fps: 10 }),
    hit: Object.freeze({ row: 3, frames: 4, fps: 10 }),
    death: Object.freeze({ row: 4, frames: 8, fps: 8 }),
  }),
  B02: Object.freeze({
    idle: Object.freeze({ row: 5, frames: 8, fps: 8 }),
    move: Object.freeze({ row: 6, frames: 6, fps: 8 }),
    attack: Object.freeze({ row: 7, frames: 8, fps: 10 }),
    hit: Object.freeze({ row: 8, frames: 4, fps: 10 }),
    death: Object.freeze({ row: 9, frames: 8, fps: 8 }),
  }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function seededUnit(seed, index) {
  let value = ((Math.abs(Math.trunc(Number(seed) || 1)) + 1) * 1103515245 + (index + 19) * 12345) >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967295;
}

function bossSpriteId(enemyId) {
  return Number(enemyId) % 2 === 0 ? "B02" : "B01";
}

export function phase3BossVisualState(enemy) {
  if (enemy?.enemyType !== "BOSS") return "NONE";
  const progress = Number(enemy.progress) || 0;
  if (progress < PHASE3_BOSS_PROGRESS.IDLE_END) return "IDLE";
  if (progress < PHASE3_BOSS_PROGRESS.ATTACK_PREP) return "MOVE";
  if (progress < PHASE3_BOSS_PROGRESS.ATTACK) return "ATTACK_PREP";
  return "ATTACK";
}

export function phase3BossAnimationName(enemy, hitAgeSeconds = Infinity, hitDurationSeconds = 0) {
  if (enemy?.enemyType !== "BOSS") {
    return Number(hitAgeSeconds) < Number(hitDurationSeconds) ? "hit" : "move";
  }
  if (Number(hitAgeSeconds) < Number(hitDurationSeconds)) return "hit";
  const state = phase3BossVisualState(enemy);
  if (state === "IDLE") return "idle";
  if (state === "ATTACK") return "attack";
  return "move";
}

export function phase3BossSpriteAnimation(enemyId, animationName) {
  const sprite = BOSS_ANIMATIONS[bossSpriteId(enemyId)];
  return sprite?.[animationName] ?? null;
}

export function phase3BossSpriteFrame(enemyId, animationName, seconds) {
  const animation = phase3BossSpriteAnimation(enemyId, animationName);
  if (!animation) return null;
  const raw = Math.max(0, Math.floor(Math.max(0, Number(seconds) || 0) * animation.fps));
  return {
    ...animation,
    frame: raw % animation.frames,
  };
}

export function phase3BossEventLifeMs(event) {
  if (event?.type === "BOSS_SPAWN") return PHASE3_TIMING.SPAWN_LIFE_MS;
  if (event?.type === "BOSS_KILL") return PHASE3_TIMING.DEATH_LIFE_MS;
  if (event?.type === "HIT" && event?.targetType === "BOSS") return PHASE3_TIMING.HIT_LIFE_MS;
  return 0;
}

export function phase3BossHitPrimitiveCount(event) {
  if (event?.type !== "HIT" || event?.targetType !== "BOSS") return 0;
  return Math.min(9, Math.max(0, Math.trunc(Number(event?.particleBudget) || 0)));
}

export function phase3BossDeathPrimitiveCount(event) {
  if (event?.type !== "BOSS_KILL") return 0;
  return Math.min(18, Math.max(0, Math.trunc(Number(event?.particleBudget) || 0)));
}

function line(ctx, ax, ay, bx, by, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

export function drawPhase3BossWarning(ctx, point, remainingSeconds) {
  if (!ctx) return false;
  const remaining = Number(remainingSeconds);
  if (!Number.isFinite(remaining) || remaining <= 0 || remaining > PHASE3_TIMING.WARNING_CONVERGE_SECONDS) return false;
  const progress = 1 - clamp01(remaining / PHASE3_TIMING.WARNING_CONVERGE_SECONDS);
  const pulse = 0.55 + 0.45 * Math.sin(progress * Math.PI * 8);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2 + progress * 0.55;
    const outer = 78 - progress * 34 + (i % 2) * 8;
    const inner = 19 - progress * 8;
    const x1 = point.x + Math.cos(angle) * outer;
    const y1 = point.y + Math.sin(angle) * outer;
    const x2 = point.x + Math.cos(angle) * inner;
    const y2 = point.y + Math.sin(angle) * inner;
    line(ctx, x1, y1, x2, y2, i % 3 === 0 ? 2.2 : 1.2, `rgba(255,53,211,${0.18 + 0.48 * progress})`);
  }
  ctx.strokeStyle = `rgba(0,245,255,${0.16 + 0.38 * progress * pulse})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 26 - progress * 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return true;
}

export function drawPhase3BossSpawn(ctx, event, point, ageMs, width, height) {
  if (!ctx || event?.type !== "BOSS_SPAWN") return false;
  const progress = clamp01(Number(ageMs) / PHASE3_TIMING.SPAWN_LIFE_MS);
  if (progress >= 1) return false;
  const life = 1 - progress;
  const burst = clamp01(Number(ageMs) / 220);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (ageMs < 150) {
    const flash = 1 - clamp01(ageMs / 150);
    ctx.fillStyle = `rgba(255,53,211,${0.07 * flash})`;
    ctx.fillRect(0, 0, width, height);
  }
  const ring1 = 10 + 68 * burst;
  const ring2 = 18 + 42 * progress;
  ctx.strokeStyle = `rgba(255,53,211,${0.78 * life})`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, ring1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(0,245,255,${0.52 * life})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, ring2, progress * 1.6, progress * 1.6 + Math.PI * 1.55);
  ctx.stroke();
  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2 + seededUnit(event.id, i) * 0.25;
    const start = 8 + 18 * progress;
    const length = 12 + seededUnit(event.id + 31, i) * 16;
    const alpha = (0.30 + seededUnit(event.id + 67, i) * 0.46) * life;
    line(
      ctx,
      point.x + Math.cos(angle) * start,
      point.y + Math.sin(angle) * start,
      point.x + Math.cos(angle) * (start + length),
      point.y + Math.sin(angle) * (start + length),
      i % 4 === 0 ? 2.4 : 1.2,
      `rgba(${i % 2 ? "255,53,211" : "0,245,255"},${alpha})`,
    );
  }
  const wobble = Math.sin(progress * Math.PI * 12) * 7 * life;
  line(ctx, point.x - 54, point.y - 4 + wobble, point.x - 14, point.y + 2, 1.2, `rgba(255,255,255,${0.28 * life})`);
  line(ctx, point.x + 54, point.y + 4 - wobble, point.x + 14, point.y - 2, 1.2, `rgba(255,255,255,${0.28 * life})`);
  ctx.restore();
  return true;
}

export function drawPhase3BossAttack(ctx, enemy, point, defensePoint, nowMs) {
  if (!ctx || enemy?.enemyType !== "BOSS") return false;
  const state = phase3BossVisualState(enemy);
  if (state !== "ATTACK_PREP" && state !== "ATTACK") return false;
  const progress = Number(enemy.progress) || 0;
  const prep = state === "ATTACK"
    ? 1
    : clamp01((progress - PHASE3_BOSS_PROGRESS.ATTACK_PREP) / (PHASE3_BOSS_PROGRESS.ATTACK - PHASE3_BOSS_PROGRESS.ATTACK_PREP));
  const pulse = 0.55 + 0.45 * Math.sin((Number(nowMs) || 0) * 0.018 + Number(enemy.id));
  const dx = defensePoint.x - point.x;
  const dy = defensePoint.y - point.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / distance;
  const uy = dy / distance;
  const px = -uy;
  const py = ux;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = `rgba(255,53,211,${0.28 + prep * 0.42 * pulse})`;
  ctx.lineWidth = state === "ATTACK" ? 3 : 2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 25 + prep * 9 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  if (state === "ATTACK") {
    for (let i = -2; i <= 2; i += 1) {
      const side = i * 4.5;
      const start = 17 + Math.abs(i) * 2;
      const end = start + 18 + (2 - Math.abs(i)) * 5;
      line(
        ctx,
        point.x + ux * start + px * side,
        point.y + uy * start + py * side,
        point.x + ux * end + px * side * 0.45,
        point.y + uy * end + py * side * 0.45,
        i === 0 ? 2.6 : 1.2,
        `rgba(${i === 0 ? "255,255,255" : "255,53,211"},${0.36 + pulse * 0.38})`,
      );
    }
  }
  ctx.restore();
  return true;
}

export function drawPhase3BossHit(ctx, event, point, ageMs) {
  if (!ctx || event?.type !== "HIT" || event?.targetType !== "BOSS") return 0;
  const progress = clamp01(Number(ageMs) / PHASE3_TIMING.HIT_LIFE_MS);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const count = phase3BossHitPrimitiveCount(event);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = `rgba(255,255,255,${0.34 * life})`;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 9 + 5 * progress, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,53,211,${0.82 * life})`;
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 18 + 30 * progress, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < count; i += 1) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 + seededUnit(event.id, i) * 0.38;
    const start = 10 + 14 * progress;
    const length = 8 + seededUnit(event.id + 101, i) * 15;
    line(
      ctx,
      point.x + Math.cos(angle) * start,
      point.y + Math.sin(angle) * start,
      point.x + Math.cos(angle) * (start + length),
      point.y + Math.sin(angle) * (start + length),
      i % 3 === 0 ? 2.2 : 1.15,
      `rgba(${i % 2 ? "255,53,211" : "244,251,255"},${(0.45 + seededUnit(event.id + 53, i) * 0.38) * life})`,
    );
  }
  ctx.restore();
  return count;
}

export function drawPhase3BossDeath(ctx, event, point, ageMs, width, height) {
  if (!ctx || event?.type !== "BOSS_KILL") return 0;
  const progress = clamp01(Number(ageMs) / PHASE3_TIMING.DEATH_LIFE_MS);
  if (progress >= 1) return 0;
  const life = 1 - progress;
  const count = phase3BossDeathPrimitiveCount(event);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (ageMs < 220) {
    const flash = 1 - clamp01(ageMs / 220);
    ctx.fillStyle = `rgba(255,255,255,${0.055 * flash})`;
    ctx.fillRect(0, 0, width, height);
  }

  const stage1 = clamp01(ageMs / 300);
  ctx.strokeStyle = `rgba(255,53,211,${0.90 * life})`;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 18 + 78 * stage1, 0, Math.PI * 2);
  ctx.stroke();

  const delayedAge = Math.max(0, ageMs - 150);
  if (delayedAge > 0) {
    const stage2 = clamp01(delayedAge / 420);
    ctx.strokeStyle = `rgba(0,245,255,${0.70 * (1 - stage2)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 14 + 64 * stage2, stage2 * 0.8, stage2 * 0.8 + Math.PI * 1.8);
    ctx.stroke();
  }

  for (let i = 0; i < count; i += 1) {
    const angle = (i / Math.max(1, count)) * Math.PI * 2 + seededUnit(event.id + 7, i) * 0.32;
    const speed = 32 + seededUnit(event.id + 71, i) * 58;
    const distance = 12 + speed * progress;
    const length = 7 + seededUnit(event.id + 113, i) * 13;
    line(
      ctx,
      point.x + Math.cos(angle) * distance,
      point.y + Math.sin(angle) * distance,
      point.x + Math.cos(angle) * (distance + length),
      point.y + Math.sin(angle) * (distance + length),
      i % 4 === 0 ? 3 : 1.5,
      `rgba(${i % 3 === 0 ? "255,255,255" : i % 2 ? "255,53,211" : "0,245,255"},${(0.38 + seededUnit(event.id + 149, i) * 0.46) * life})`,
    );
  }

  if (ageMs >= 260 && ageMs <= 760) {
    const secondary = clamp01((ageMs - 260) / 500);
    for (let burst = 0; burst < 3; burst += 1) {
      const angle = burst * (Math.PI * 2 / 3) + 0.4;
      const radius = 24 + burst * 12;
      const cx = point.x + Math.cos(angle) * radius;
      const cy = point.y + Math.sin(angle) * radius;
      for (let ray = 0; ray < 5; ray += 1) {
        const rayAngle = ray * (Math.PI * 2 / 5) + burst * 0.2;
        const inner = 3 + 8 * secondary;
        const outer = inner + 8 + burst * 2;
        line(
          ctx,
          cx + Math.cos(rayAngle) * inner,
          cy + Math.sin(rayAngle) * inner,
          cx + Math.cos(rayAngle) * outer,
          cy + Math.sin(rayAngle) * outer,
          1.2,
          `rgba(${burst % 2 ? "0,245,255" : "255,53,211"},${0.52 * (1 - secondary)})`,
        );
      }
    }
  }

  ctx.strokeStyle = `rgba(255,53,211,${0.18 * life})`;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 70 + 28 * progress, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  return count;
}
