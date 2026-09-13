import { GRID_SIZE } from "./game_rules.js";
import { columnLevel, columnPower, weaponType, WeaponType } from "./column_combat_rules.js";
import { feverActive, feverGaugeRatio } from "./combo_fever.js";
import { displayIndexToLogicalIndex, logicalPointToScreen } from "./orientation.js";

const COLORS = {
  bg: "#020406",
  panel: "#060a0f",
  laneA: "#05090d",
  laneB: "#03070a",
  lane: "#17303a",
  cyan: "#00f5ff",
  pink: "#ff35d3",
  lime: "#63ff8c",
  amber: "#ffb020",
  red: "#ff3b58",
  white: "#f4fbff",
  muted: "#a4b7c2",
};

const WEAPON_COLORS = {
  NORMAL: "#8994a4",
  RAPID: "#58a8d0",
  MACHINE_GUN: "#69bd89",
  PIERCING: "#aa62ff",
  EXPLOSIVE: "#ff7a18",
  LASER: "#ff35d3",
};

const WEAPON_SPRITES = {
  NORMAL: {
    cooldown: .90,
    idle: { src: new URL("../assets/sprites/weapons/W01_blaster_idle.png", import.meta.url).href, frames: 4, fps: 4 },
    fire: { src: new URL("../assets/sprites/weapons/W01_blaster_fire.png", import.meta.url).href, frames: 4, fps: 12 },
  },
  RAPID: {
    cooldown: .62,
    idle: { src: new URL("../assets/sprites/weapons/W02_needler_idle.png", import.meta.url).href, frames: 4, fps: 6 },
    fire: { src: new URL("../assets/sprites/weapons/W02_needler_fire.png", import.meta.url).href, frames: 6, fps: 15 },
  },
  MACHINE_GUN: {
    cooldown: .24,
    idle: { src: new URL("../assets/sprites/weapons/W03_gatler_idle.png", import.meta.url).href, frames: 4, fps: 4 },
    fire: { src: new URL("../assets/sprites/weapons/W03_gatler_fire.png", import.meta.url).href, frames: 6, fps: 18 },
  },
  PIERCING: {
    cooldown: .72,
    idle: { src: new URL("../assets/sprites/weapons/W04_rail_lancer_idle.png", import.meta.url).href, frames: 4, fps: 5 },
    fire: { src: new URL("../assets/sprites/weapons/W04_rail_lancer_fire.png", import.meta.url).href, frames: 6, fps: 12 },
  },
  EXPLOSIVE: {
    cooldown: .95,
    idle: { src: new URL("../assets/sprites/weapons/W05_bomb_howl_idle.png", import.meta.url).href, frames: 4, fps: 4 },
    fire: { src: new URL("../assets/sprites/weapons/W05_bomb_howl_fire.png", import.meta.url).href, frames: 6, fps: 10 },
  },
  LASER: {
    cooldown: .78,
    idle: { src: new URL("../assets/sprites/weapons/W06_helios_idle.png", import.meta.url).href, frames: 6, fps: 6 },
    fire: { src: new URL("../assets/sprites/weapons/W06_helios_fire.png", import.meta.url).href, frames: 8, fps: 14 },
  },
};

const NORMAL_ENEMY_ATLAS = new URL("../assets/sprites/enemies/enemy_normal_atlas.png", import.meta.url).href;
const BOSS_ENEMY_ATLAS = new URL("../assets/sprites/enemies/enemy_boss_atlas.png", import.meta.url).href;

const ENEMY_SPRITES = {
  E01: { frameSize: 64, move: { row: 0, frames: 8, fps: 10 }, hit: { row: 1, frames: 3, fps: 12 }, death: { row: 2, frames: 5, fps: 10 } },
  E02: { frameSize: 64, move: { row: 3, frames: 6, fps: 12 }, hit: { row: 4, frames: 3, fps: 12 }, death: { row: 5, frames: 5, fps: 10 } },
  E03: { frameSize: 64, move: { row: 6, frames: 6, fps: 8 }, hit: { row: 7, frames: 3, fps: 10 }, death: { row: 8, frames: 5, fps: 8 } },
  E04: { frameSize: 64, move: { row: 9, frames: 6, fps: 10 }, hit: { row: 10, frames: 3, fps: 12 }, death: { row: 11, frames: 5, fps: 10 } },
  B01: { frameSize: 128, idle: { row: 0, frames: 6, fps: 6 }, move: { row: 1, frames: 8, fps: 8 }, attack: { row: 2, frames: 8, fps: 10 }, hit: { row: 3, frames: 4, fps: 10 }, death: { row: 4, frames: 8, fps: 8 } },
  B02: { frameSize: 128, idle: { row: 5, frames: 8, fps: 8 }, move: { row: 6, frames: 6, fps: 8 }, attack: { row: 7, frames: 8, fps: 10 }, hit: { row: 8, frames: 4, fps: 10 }, death: { row: 9, frames: 8, fps: 8 } },
};

const weaponImages = new Map();
const enemyImages = new Map();
let lastBossSpriteId = "B01";

function cachedImage(cache, src) {
  let image = cache.get(src);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = src;
    cache.set(src, image);
  }
  return image;
}

function weaponImage(src) { return cachedImage(weaponImages, src); }
function enemyImage(src) { return cachedImage(enemyImages, src); }

function normalSpriteId(lane) {
  return `E0${Math.max(0, Math.min(3, lane)) + 1}`;
}

function bossSpriteId(enemyId) {
  return Number(enemyId) % 2 === 0 ? "B02" : "B01";
}

function enemyAtlas(spriteId) {
  return spriteId.startsWith("B") ? BOSS_ENEMY_ATLAS : NORMAL_ENEMY_ATLAS;
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

function screenPoint(x, y, landscape, w, h, landscapeHand = "left") {
  const p = logicalPointToScreen(x, y, landscape, landscapeHand);
  return { x: p.x * w, y: p.y * h };
}

export function renderBattle(canvas, state, landscape, landscapeHand = "left") {
  const { ctx, w, h } = resizeCanvas(canvas);
  const fever = feverActive(state.comboFever);
  const phase = state.elapsedSeconds;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = fever ? "#100619" : COLORS.panel;
  ctx.fillRect(0, 0, w, h);

  drawLanes(ctx, w, h, landscape, fever, phase, landscapeHand);
  drawBossAxis(ctx, w, h, landscape, Boolean(state.bossWarning), fever, phase);
  drawDefenseLine(ctx, w, h, landscape, fever, phase, landscapeHand);

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const logical = { x: (col + 0.5) / GRID_SIZE, y: 0.955 };
    const point = screenPoint(logical.x, logical.y, landscape, w, h, landscapeHand);
    const type = weaponType(columnLevel(state.board, col));
    const spec = WEAPON_SPRITES[type] ?? WEAPON_SPRITES.NORMAL;
    const ready = 1 - Math.min(1, state.cooldowns[col] / Math.max(0.01, spec.cooldown));
    const aimAngle = fever ? Number(state.turretAims?.[col]?.angle) || 0 : 0;
    drawTurret(ctx, point.x, point.y, type, landscape, ready, fever, phase, aimAngle, landscapeHand);
  }

  for (const enemy of state.enemies) {
    const hit = latestHitForEnemy(enemy, state.vfxEvents ?? []);
    drawEnemy(ctx, enemy, hit, landscape, w, h, fever, phase, landscapeHand);
  }
  for (const projectile of state.projectiles) {
    const point = screenPoint(projectile.x, projectile.y, landscape, w, h, landscapeHand);
    drawProjectile(ctx, point.x, point.y, projectile.weaponType, landscape, fever, landscapeHand);
  }
  for (const event of state.vfxEvents ?? []) {
    if (event.type === "KILL" || event.type === "BOSS_KILL") {
      drawEnemyDeath(ctx, event, state.elapsedSeconds, landscape, w, h, landscapeHand);
    }
    drawImpact(ctx, event, state.elapsedSeconds, landscape, w, h, fever, landscapeHand);
  }

  if (fever) drawFeverAtmosphere(ctx, w, h, phase);
}

function drawLanes(ctx, w, h, landscape, fever, phase, landscapeHand) {
  for (let lane = 0; lane < GRID_SIZE; lane += 1) {
    const even = lane % 2 === 0;
    const base = fever ? (even ? "#100718" : "#07101a") : (even ? COLORS.laneA : COLORS.laneB);
    ctx.fillStyle = base;
    if (landscape) ctx.fillRect(0, lane * h / 4, w, h / 4);
    else ctx.fillRect(lane * w / 4, 0, w / 4, h);
  }
  for (let line = 1; line < GRID_SIZE; line += 1) {
    const pulse = .55 + .25 * Math.sin(phase * 5 + line);
    ctx.strokeStyle = fever && line % 2 ? `rgba(255,53,211,${pulse})` : fever ? `rgba(0,245,255,${pulse})` : "rgba(0,245,255,.38)";
    ctx.lineWidth = fever ? 2.2 : 1.3;
    ctx.beginPath();
    if (landscape) { const y = line * h / 4; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    else { const x = line * w / 4; ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    ctx.stroke();
  }

  ctx.save();
  ctx.fillStyle = fever ? "rgba(255,255,255,.50)" : "rgba(164,183,194,.65)";
  ctx.font = "700 10px system-ui";
  ctx.textAlign = "center";
  for (let lane = 0; lane < 4; lane += 1) {
    if (landscape) ctx.fillText(String(lane + 1), landscapeHand === "right" ? 12 : w - 12, (lane + .5) * h / 4 + 3);
    else ctx.fillText(String(lane + 1), (lane + .5) * w / 4, 14);
  }
  ctx.restore();
}

function drawBossAxis(ctx, w, h, landscape, warning, fever, phase) {
  const pulse = .5 + .5 * Math.sin(phase * 6);
  ctx.strokeStyle = warning ? `rgba(255,53,211,${.7 + .3*pulse})` : fever ? "rgba(255,53,211,.34)" : "rgba(255,53,211,.42)";
  ctx.lineWidth = warning ? 3.5 : 1.6;
  ctx.setLineDash(warning ? [10, 7] : []);
  ctx.beginPath();
  if (landscape) { ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); }
  else { ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); }
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawDefenseLine(ctx, w, h, landscape, fever, phase, landscapeHand) {
  const p0 = screenPoint(0, .985, landscape, w, h, landscapeHand);
  const p1 = screenPoint(1, .985, landscape, w, h, landscapeHand);
  const pulse = .55 + .45 * Math.sin(phase * 4);
  ctx.strokeStyle = fever ? `rgba(255,53,211,${.65 + .25*pulse})` : "rgba(0,245,255,.75)";
  ctx.lineWidth = fever ? 4 : 2;
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  ctx.fillStyle = fever ? COLORS.pink : COLORS.cyan;
  ctx.font = "800 9px system-ui";
  if (landscape) {
    ctx.save();
    const rightHand = landscapeHand === "right";
    ctx.translate(p0.x + (rightHand ? -8 : 8), h - 8);
    ctx.rotate(rightHand ? Math.PI / 2 : -Math.PI / 2);
    ctx.fillText("DEFENSE", 0, 0);
    ctx.restore();
  } else ctx.fillText("DEFENSE LINE", 8, p0.y - 7);
}

function latestHitForEnemy(enemy, events) {
  const logicalX = enemy.enemyType === "BOSS" ? .5 : (enemy.lane + .5) / GRID_SIZE;
  let best = null;
  let bestDistance = Infinity;
  for (const event of events) {
    if (event.type !== "HIT") continue;
    const dx = Math.abs(event.x - logicalX);
    const dy = Math.abs(event.y - enemy.progress);
    if (dx > .02 || dy > .06) continue;
    const distance = dx + dy;
    if (distance < bestDistance || (distance === bestDistance && (!best || event.createdAtSeconds > best.createdAtSeconds))) {
      best = event;
      bestDistance = distance;
    }
  }
  return best;
}

function spriteFrame(animation, seconds, loop) {
  const raw = Math.max(0, Math.floor(seconds * animation.fps));
  return loop ? raw % animation.frames : Math.min(animation.frames - 1, raw);
}

function drawEnemySprite(ctx, x, y, spriteId, animationName, seconds, displaySize, landscape, landscapeHand, loop = true) {
  const spec = ENEMY_SPRITES[spriteId];
  const animation = spec?.[animationName];
  if (!spec || !animation) return false;
  const image = enemyImage(enemyAtlas(spriteId));
  if (!image.complete || image.naturalWidth <= 0) return false;
  const frame = spriteFrame(animation, seconds, loop);
  const sourceSize = spec.frameSize;
  ctx.save();
  ctx.translate(x, y);
  if (landscape) ctx.rotate(landscapeHand === "right" ? -Math.PI / 2 : Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    frame * sourceSize,
    animation.row * sourceSize,
    sourceSize,
    sourceSize,
    -displaySize / 2,
    -displaySize / 2,
    displaySize,
    displaySize,
  );
  ctx.restore();
  return true;
}

function drawEnemy(ctx, enemy, hitEvent, landscape, w, h, fever, phase, landscapeHand) {
  const logicalX = enemy.enemyType === "BOSS" ? .5 : (enemy.lane + .5) / GRID_SIZE;
  const point = screenPoint(logicalX, enemy.progress, landscape, w, h, landscapeHand);
  const base = Math.min(w, h);
  const r = enemy.enemyType === "BOSS" ? Math.max(18, base * .065) : Math.max(10, base * .033);
  const color = enemy.enemyType === "BOSS" ? COLORS.pink : COLORS.red;
  const pulse = .7 + .3 * Math.sin(phase * 7 + enemy.id);
  const spriteId = enemy.enemyType === "BOSS" ? bossSpriteId(enemy.id) : normalSpriteId(enemy.lane);
  if (enemy.enemyType === "BOSS") lastBossSpriteId = spriteId;
  const hitSpec = ENEMY_SPRITES[spriteId]?.hit;
  const hitAge = hitEvent ? Math.max(0, phase - hitEvent.createdAtSeconds) : Infinity;
  const hitDuration = hitSpec ? hitSpec.frames / hitSpec.fps : 0;
  const animationName = hitAge < hitDuration ? "hit" : "move";
  const animationTime = animationName === "hit" ? hitAge : phase + enemy.id * .071;
  const displaySize = enemy.enemyType === "BOSS" ? Math.max(72, r * 3) : Math.max(36, r * 3);

  const drawn = drawEnemySprite(ctx, point.x, point.y, spriteId, animationName, animationTime, displaySize, landscape, landscapeHand, animationName === "move");
  if (!drawn) {
    ctx.fillStyle = enemy.enemyType === "BOSS" ? `rgba(255,53,211,${.10 + .08*pulse})` : "rgba(255,59,88,.10)";
    ctx.beginPath(); ctx.arc(point.x, point.y, r * 1.65, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.beginPath(); ctx.arc(point.x, point.y, r * .28, 0, Math.PI * 2); ctx.fill();
  }

  const ratio = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const bw = r * 2.4;
  const bh = 5;
  if (landscape) {
    const x = point.x - r - 10;
    const y = point.y - bw / 2;
    ctx.fillStyle = "#101820"; ctx.fillRect(x, y, bh, bw);
    ctx.fillStyle = COLORS.lime; ctx.fillRect(x, y + bw * (1-ratio), bh, bw * ratio);
  } else {
    const x = point.x - bw/2, y = point.y - r - 10;
    ctx.fillStyle = "#101820"; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = COLORS.lime; ctx.fillRect(x, y, bw * ratio, bh);
  }
  if (fever) {
    ctx.strokeStyle = `rgba(255,255,255,${.35 + .25*pulse})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(point.x, point.y, r * 1.16, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawEnemyDeath(ctx, event, elapsed, landscape, w, h, landscapeHand) {
  const age = Math.max(0, elapsed - event.createdAtSeconds);
  const isBoss = event.type === "BOSS_KILL";
  const lane = Math.max(0, Math.min(3, Math.floor(event.x * GRID_SIZE)));
  const spriteId = isBoss ? lastBossSpriteId : normalSpriteId(lane);
  const spec = ENEMY_SPRITES[spriteId]?.death;
  if (!spec || age > spec.frames / spec.fps) return;
  const point = screenPoint(event.x, event.y, landscape, w, h, landscapeHand);
  const base = Math.min(w, h);
  const r = isBoss ? Math.max(18, base * .065) : Math.max(10, base * .033);
  const displaySize = isBoss ? Math.max(72, r * 3) : Math.max(36, r * 3);
  drawEnemySprite(ctx, point.x, point.y, spriteId, "death", age, displaySize, landscape, landscapeHand, false);
}

function drawWeaponFrame(ctx, type, readyRatio, phase) {
  const spec = WEAPON_SPRITES[type] ?? WEAPON_SPRITES.NORMAL;
  const ready = Math.max(0, Math.min(1, readyRatio));
  const sinceShot = spec.cooldown * ready;
  const fireDuration = spec.fire.frames / spec.fire.fps;
  const firing = ready < 1 && sinceShot < fireDuration;
  const animation = firing ? spec.fire : spec.idle;
  const seconds = firing ? sinceShot : phase;
  const frame = firing
    ? Math.min(animation.frames - 1, Math.max(0, Math.floor(seconds * animation.fps)))
    : Math.max(0, Math.floor(seconds * animation.fps) % animation.frames);
  const image = weaponImage(animation.src);
  if (!image.complete || image.naturalWidth <= 0) return false;

  const size = 56;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame * 64, 0, 64, 64, -size / 2, -size * .875, size, size);
  return true;
}

function drawTurret(ctx, x, y, type, landscape, readyRatio, fever, phase, aimAngle, landscapeHand) {
  const color = WEAPON_COLORS[type] ?? WEAPON_COLORS.NORMAL;
  ctx.save();
  ctx.translate(x, y);
  if (landscape) ctx.rotate(landscapeHand === "right" ? -Math.PI / 2 : Math.PI / 2);

  ctx.save();
  ctx.rotate(aimAngle);
  if (!drawWeaponFrame(ctx, type, readyRatio, phase)) {
    ctx.fillStyle = color;
    ctx.fillRect(-11, -8, 22, 9);
    ctx.fillRect(-2.5, -18, 5, 12);
  }
  ctx.restore();

  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, -5, 18, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.max(0,Math.min(1,readyRatio))); ctx.stroke();
  if (fever) {
    ctx.strokeStyle = `rgba(255,53,211,${.6 + .25*Math.sin(phase*6)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -5, 24, phase*2, phase*2 + Math.PI*.9); ctx.stroke();
  }
  ctx.restore();
}

function drawProjectile(ctx, x, y, type, landscape, fever, landscapeHand) {
  ctx.save();
  ctx.translate(x, y);
  if (landscape) ctx.rotate(landscapeHand === "right" ? -Math.PI / 2 : Math.PI / 2);
  if (type === WeaponType.LASER) {
    ctx.strokeStyle = "#ff75a2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -22); ctx.stroke();
  } else if (type === WeaponType.PIERCING) {
    ctx.strokeStyle = "#bea6f4"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -11); ctx.stroke();
  } else if (type === WeaponType.EXPLOSIVE) {
    ctx.fillStyle = "#ff7a18"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffd0a8"; ctx.stroke();
  } else if (type === WeaponType.MACHINE_GUN) {
    ctx.strokeStyle = "#69bd89"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 7); ctx.lineTo(0, -7); ctx.stroke();
  } else {
    ctx.fillStyle = type === WeaponType.RAPID ? "#58a8d0" : "#f4fbff";
    ctx.beginPath(); ctx.arc(0, 0, type === WeaponType.RAPID ? 3 : 4.5, 0, Math.PI * 2); ctx.fill();
  }
  if (fever) {
    ctx.fillStyle = "rgba(255,255,255,.72)"; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,53,211,.16)"; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawImpact(ctx, event, elapsed, landscape, w, h, fever, landscapeHand) {
  const age = Math.max(0, elapsed - event.createdAtSeconds);
  const life = Math.max(0, 1 - age / .9);
  if (life <= 0) return;
  const p = screenPoint(event.x, event.y, landscape, w, h, landscapeHand);
  const kill = event.type === "KILL" || event.type === "BOSS_KILL";
  const maxR = event.type === "BOSS_KILL" ? 58 : kill ? 34 : 20;
  ctx.strokeStyle = event.type === "BOSS_KILL" ? `rgba(255,53,211,${life})` : kill ? `rgba(0,245,255,${life})` : `rgba(255,176,32,${life*.75})`;
  ctx.lineWidth = event.type === "BOSS_KILL" ? 5 : 2.5;
  ctx.beginPath(); ctx.arc(p.x, p.y, maxR*(1-life*.35), 0, Math.PI*2); ctx.stroke();
  if (fever || kill) {
    const rays = event.type === "BOSS_KILL" ? 12 : 7;
    for (let i=0;i<rays;i+=1) {
      const a = i * Math.PI*2/rays + age*4;
      const r1 = maxR*.35, r2=maxR*(.7+.25*(1-life));
      ctx.beginPath(); ctx.moveTo(p.x+Math.cos(a)*r1,p.y+Math.sin(a)*r1); ctx.lineTo(p.x+Math.cos(a)*r2,p.y+Math.sin(a)*r2); ctx.stroke();
    }
  }
  ctx.fillStyle = `rgba(244,251,255,${life})`;
  ctx.font = `900 ${event.type === "BOSS_KILL" ? 18 : 12}px system-ui`;
  ctx.textAlign = "center";
  if (event.damage > 0) ctx.fillText(String(event.damage), p.x, p.y - maxR*.65);
  ctx.textAlign = "start";
}

function drawFeverAtmosphere(ctx, w, h, phase) {
  const pulse = .5 + .5 * Math.sin(phase * 6);
  const grad = ctx.createLinearGradient(0,0,w,0);
  grad.addColorStop(0, `rgba(255,53,211,${.12 + .06*pulse})`);
  grad.addColorStop(.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, `rgba(0,245,255,${.10 + .05*pulse})`);
  ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle = `rgba(255,255,255,${.25 + .2*pulse})`; ctx.lineWidth = 2.5;
  ctx.strokeRect(1.5,1.5,w-3,h-3);

  // Lightweight built-in particles; no third-party calls are allowed in Playables.
  for (let i=0;i<18;i+=1) {
    const t = (phase*.22 + i*.173) % 1;
    const fromLeft = i % 2 === 0;
    const x = fromLeft ? t*w*.22 : w - t*w*.22;
    const y = ((i*.319 + phase*.08) % 1) * h;
    ctx.fillStyle = i%3===0 ? "rgba(255,53,211,.58)" : i%3===1 ? "rgba(0,245,255,.55)" : "rgba(255,255,255,.55)";
    ctx.beginPath(); ctx.arc(x,y,1.5+(i%2),0,Math.PI*2); ctx.fill();
  }
}

export function renderBoard(container, board, landscape) {
  const fragment = document.createDocumentFragment();
  for (let displayIndex = 0; displayIndex < board.length; displayIndex += 1) {
    const logicalIndex = displayIndexToLogicalIndex(displayIndex, landscape, GRID_SIZE);
    const value = board[logicalIndex];
    const tile = document.createElement("div");
    tile.className = `tile${value >= 128 ? " high" : ""}`;
    tile.dataset.value = String(value);
    tile.dataset.logicalIndex = String(logicalIndex);
    tile.textContent = value ? String(value) : "";
    tile.setAttribute("aria-label", value ? String(value) : "empty");
    fragment.appendChild(tile);
  }
  container.replaceChildren(fragment);
}

export function renderWeaponStrip(container, board) {
  const fragment = document.createDocumentFragment();
  for (let col = 0; col < GRID_SIZE; col += 1) {
    const level = columnLevel(board, col);
    const type = weaponType(level);
    const power = columnPower(board, col);
    const card = document.createElement("div");
    card.className = `weapon-card weapon-${type}`;
    card.dataset.lane = String(col);
    card.innerHTML = `<span class="lane-no">${col + 1}</span><span class="lv">LV ${level}</span><span class="weapon">${type.replace("MACHINE_GUN", "M.GUN")}</span><span class="atk">ATK ${power}</span>`;
    fragment.appendChild(card);
  }
  container.replaceChildren(fragment);
}

export function renderComboFever(root, state) {
  const cf = state.comboFever;
  root.classList.toggle("fever-active", feverActive(cf));
  const gauge = root.querySelector("#fever-fill");
  gauge.style.transform = `scaleX(${feverGaugeRatio(cf)})`;
  root.querySelector("#fever-meter").classList.toggle("active", feverActive(cf));
}
