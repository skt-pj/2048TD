import { GameEngine } from "./game_engine.js";
import { GRID_SIZE } from "./game_rules.js";
import { columnLevel, weaponType } from "./column_combat_rules.js";
import { feverActive } from "./combo_fever.js";

const BASE = "./assets/sfx";
const FILES = Object.freeze({
  ui: "ui_click.mp3",
  move: "board_move.mp3",
  merge: "tile_merge.mp3",
  combo: "combo.mp3",
  feverStart: "fever_start.mp3",
  feverEnd: "fever_end.mp3",
  evolve: "weapon_evolve.mp3",
  NORMAL: "weapon_normal.mp3",
  RAPID: "weapon_rapid.mp3",
  MACHINE_GUN: "weapon_machine_gun.mp3",
  PIERCING: "weapon_piercing.mp3",
  EXPLOSIVE: "weapon_explosive.mp3",
  LASER: "weapon_laser.mp3",
  impact: "impact.mp3",
  kill: "enemy_kill.mp3",
  bossKill: "boss_kill.mp3",
  bossWarning: "boss_warning.mp3",
  wave: "wave.mp3",
  baseDamage: "base_damage.mp3",
  gameOver: "game_over.mp3",
});

const DEFAULTS = Object.freeze({
  ui: { volume: 0.22, throttleMs: 35 },
  move: { volume: 0.16, throttleMs: 70 },
  merge: { volume: 0.30, throttleMs: 30 },
  combo: { volume: 0.26, throttleMs: 70 },
  feverStart: { volume: 0.55, throttleMs: 500 },
  feverEnd: { volume: 0.36, throttleMs: 500 },
  evolve: { volume: 0.44, throttleMs: 180 },
  NORMAL: { volume: 0.13, throttleMs: 90 },
  RAPID: { volume: 0.11, throttleMs: 80 },
  MACHINE_GUN: { volume: 0.08, throttleMs: 65 },
  PIERCING: { volume: 0.15, throttleMs: 95 },
  EXPLOSIVE: { volume: 0.18, throttleMs: 110 },
  LASER: { volume: 0.15, throttleMs: 90 },
  impact: { volume: 0.13, throttleMs: 45 },
  kill: { volume: 0.25, throttleMs: 70 },
  bossKill: { volume: 0.55, throttleMs: 500 },
  bossWarning: { volume: 0.42, throttleMs: 800 },
  wave: { volume: 0.25, throttleMs: 300 },
  baseDamage: { volume: 0.48, throttleMs: 180 },
  gameOver: { volume: 0.50, throttleMs: 800 },
});

class SfxPlayer {
  constructor() {
    this.lastPlayed = new Map();
    this.templates = new Map();
    for (const [key, file] of Object.entries(FILES)) {
      const audio = new Audio(`${BASE}/${file}`);
      audio.preload = "auto";
      this.templates.set(key, audio);
    }
  }

  play(key, options = {}) {
    const template = this.templates.get(key);
    if (!template) return;
    const defaults = DEFAULTS[key] ?? {};
    const throttleMs = options.throttleMs ?? defaults.throttleMs ?? 0;
    const now = performance.now();
    const last = this.lastPlayed.get(key) ?? -Infinity;
    if (now - last < throttleMs) return;
    this.lastPlayed.set(key, now);

    const audio = template.cloneNode(true);
    audio.volume = Math.max(0, Math.min(1, options.volume ?? defaults.volume ?? 0.2));
    audio.playbackRate = Math.max(0.75, Math.min(1.35, options.rate ?? 1));
    audio.play().catch(() => {});
  }
}

const sfx = new SfxPlayer();

function weaponTypes(board) {
  const result = [];
  for (let column = 0; column < GRID_SIZE; column += 1) {
    result.push(weaponType(columnLevel(board, column)));
  }
  return result;
}

function rateForMerge(createdValues) {
  const peak = Math.max(2, ...(createdValues ?? []));
  return Math.min(1.28, 0.92 + Math.log2(peak) * 0.025);
}

const originalMove = GameEngine.prototype.move;
GameEngine.prototype.move = function patchedMove(direction) {
  const beforeBoard = this.state.board.slice();
  const beforeWeapons = weaponTypes(beforeBoard);
  const beforeFeverCount = this.state.comboFever.feverCount;
  const beforeGameOver = this.state.gameOverReason;
  const result = originalMove.call(this, direction);

  if (!result.changed) return result;
  sfx.play("move", { rate: 0.97 + Math.random() * 0.06 });

  if (result.mergeCount > 0) {
    sfx.play("merge", { rate: rateForMerge(result.createdValues) });
    if (result.mergeCount > 1) sfx.play("combo", { rate: Math.min(1.20, 0.98 + result.mergeCount * 0.035) });
  }

  if (this.state.comboFever.feverCount > beforeFeverCount) sfx.play("feverStart");

  const afterWeapons = weaponTypes(this.state.board);
  if (afterWeapons.some((type, index) => type !== beforeWeapons[index])) sfx.play("evolve");

  if (!beforeGameOver && this.state.gameOverReason) sfx.play("gameOver");
  return result;
};

const originalTick = GameEngine.prototype.tick;
GameEngine.prototype.tick = function patchedTick(deltaSeconds) {
  const beforeHp = this.state.currentHp;
  const beforeWave = this.state.wave;
  const beforeBossWarning = Boolean(this.state.bossWarning);
  const beforeGameOver = this.state.gameOverReason;
  const beforeFever = feverActive(this.state.comboFever);
  const lastVfxId = this.state.vfxEvents.reduce((max, event) => Math.max(max, Number(event.id) || 0), 0);
  const fired = [];

  const projectiles = this.state.projectiles;
  const originalPush = projectiles.push;
  projectiles.push = function interceptedPush(...items) {
    for (const item of items) {
      if (item?.weaponType) fired.push(item.weaponType);
    }
    return originalPush.apply(this, items);
  };

  const result = originalTick.call(this, deltaSeconds);

  const uniqueFired = [...new Set(fired)];
  for (const type of uniqueFired) sfx.play(type, { rate: 0.97 + Math.random() * 0.06 });

  for (const event of this.state.vfxEvents) {
    if ((Number(event.id) || 0) <= lastVfxId) continue;
    if (event.type === "BOSS_KILL") sfx.play("bossKill");
    else if (event.type === "KILL") sfx.play("kill", { rate: 0.96 + Math.random() * 0.08 });
    else if (event.type === "HIT") sfx.play("impact", { rate: 0.96 + Math.random() * 0.08 });
  }

  if (this.state.currentHp < beforeHp) sfx.play("baseDamage");
  if (this.state.wave > beforeWave) sfx.play("wave");
  if (!beforeBossWarning && this.state.bossWarning) sfx.play("bossWarning");
  if (beforeFever && !feverActive(this.state.comboFever)) sfx.play("feverEnd");
  if (!beforeGameOver && this.state.gameOverReason) sfx.play("gameOver");

  return result;
};

const UI_IDS = new Set([
  "settings-button", "settings-close", "settings-done", "settings-restart",
  "hand-left", "hand-right", "play-again",
]);

document.addEventListener("click", (event) => {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (button && UI_IDS.has(button.id)) sfx.play("ui", { rate: 0.98 + Math.random() * 0.04 });
}, { capture: true });
