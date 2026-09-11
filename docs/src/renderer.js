import { GRID_SIZE } from "./game_rules.js";
import { columnLevel, columnPower, weaponType, WeaponType } from "./column_combat_rules.js";

const COLORS = {
  bg: "#0f141c", lane: "#25303d", defense: "#d39a4c", enemy: "#c8d3df", boss: "#e7984d",
  hpBg: "#3a4554", hp: "#6bc47d", projectile: "#e9e0c9",
};

export function renderBattle(canvas, state) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);

  for (let i = 0; i <= GRID_SIZE; i += 1) {
    const x = i * w / GRID_SIZE;
    ctx.strokeStyle = COLORS.lane; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  ctx.strokeStyle = state.bossWarning ? "#c47b36" : "#3a2d26";
  ctx.lineWidth = state.bossWarning ? 5 : 2;
  ctx.setLineDash(state.bossWarning ? [9, 8] : [5, 9]);
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h * .94); ctx.stroke(); ctx.setLineDash([]);

  const defenseY = h * .955;
  ctx.strokeStyle = COLORS.defense; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, defenseY); ctx.lineTo(w, defenseY); ctx.stroke();
  ctx.font = "700 10px system-ui"; ctx.fillStyle = "#cfa45f"; ctx.fillText("DEFENSE LINE", 8, defenseY - 7);

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const x = (col + .5) * w / GRID_SIZE;
    const type = weaponType(columnLevel(state.board, col));
    drawTurret(ctx, x, defenseY - 2, type);
  }

  for (const enemy of state.enemies) {
    const x = (enemy.enemyType === "BOSS" ? .5 : (enemy.lane + .5) / GRID_SIZE) * w;
    const y = enemy.progress * h;
    const r = enemy.enemyType === "BOSS" ? Math.max(19, w * .045) : Math.max(11, w * .025);
    ctx.fillStyle = enemy.enemyType === "BOSS" ? COLORS.boss : COLORS.enemy;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    const ratio = Math.max(0, enemy.hp / enemy.maxHp);
    ctx.fillStyle = COLORS.hpBg; ctx.fillRect(x - r, y - r - 9, r * 2, 4);
    ctx.fillStyle = COLORS.hp; ctx.fillRect(x - r, y - r - 9, r * 2 * ratio, 4);
    if (enemy.enemyType === "BOSS") {
      ctx.fillStyle = "#1d140d"; ctx.font = "900 10px system-ui"; ctx.textAlign = "center"; ctx.fillText("BOSS", x, y + 3); ctx.textAlign = "start";
    }
  }

  for (const p of state.projectiles) {
    const x = p.x * w, y = p.y * h;
    drawProjectile(ctx, x, y, p.weaponType);
  }
}

function drawTurret(ctx, x, y, type) {
  const colors = { NORMAL: "#8994a4", RAPID: "#58a8d0", MACHINE_GUN: "#69bd89", PIERCING: "#a38add", EXPLOSIVE: "#dd8a59", LASER: "#e96691" };
  ctx.fillStyle = colors[type] ?? "#8994a4";
  ctx.fillRect(x - 10, y - 9, 20, 9);
  ctx.fillRect(x - 2, y - 17, 4, 10);
}

function drawProjectile(ctx, x, y, type) {
  ctx.save();
  if (type === WeaponType.LASER) {
    ctx.strokeStyle = "#ff75a2"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, y + 12); ctx.lineTo(x, y - 22); ctx.stroke();
  } else if (type === WeaponType.PIERCING) {
    ctx.strokeStyle = "#bea6f4"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 7); ctx.lineTo(x, y - 9); ctx.stroke();
  } else if (type === WeaponType.EXPLOSIVE) {
    ctx.fillStyle = "#e9935f"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#ffc59c"; ctx.stroke();
  } else if (type === WeaponType.MACHINE_GUN) {
    ctx.strokeStyle = "#79d49a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y - 5); ctx.stroke();
  } else {
    ctx.fillStyle = type === WeaponType.RAPID ? "#62b5df" : COLORS.projectile;
    ctx.beginPath(); ctx.arc(x, y, type === WeaponType.RAPID ? 2.5 : 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function renderBoard(container, board) {
  const fragment = document.createDocumentFragment();
  board.forEach((value) => {
    const tile = document.createElement("div");
    tile.className = `tile${value >= 128 ? " high" : ""}`;
    tile.dataset.value = String(value);
    tile.textContent = value ? String(value) : "";
    tile.setAttribute("aria-label", value ? String(value) : "empty");
    fragment.appendChild(tile);
  });
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
    card.innerHTML = `<span class="lv">LV ${level}</span><span class="weapon">${type.replace("MACHINE_GUN", "M.GUN")}</span><span class="atk">ATK ${power}</span>`;
    fragment.appendChild(card);
  }
  container.replaceChildren(fragment);
}
