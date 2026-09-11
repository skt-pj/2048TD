import { GameEngine } from "./game_engine.js";
import { PlayablesBridge } from "./playables.js";
import { strings } from "./i18n.js";
import { renderBattle, renderBoard, renderWeaponStrip } from "./renderer.js";

const bridge = new PlayablesBridge();
const engine = new GameEngine();
let bestScore = 0;
let paused = false;
let raf = 0;
let lastTime = 0;
let text = strings("en-US");
let gameOverReported = false;

const $ = (id) => document.getElementById(id);
const app = $("app");
const loading = $("loading");
const canvas = $("battlefield");
const boardEl = $("board");
const gameOverEl = $("game-over");

function applyStrings() {
  $("restart").textContent = text.restart;
  $("hp-label").textContent = text.hp;
  $("wave-label").textContent = text.wave;
  $("score-label").textContent = text.score;
  $("total-hp-label").textContent = text.totalHp;
  $("hint").textContent = text.hint;
  $("game-over-title").textContent = text.gameOver;
  $("final-score-label").textContent = text.finalScore;
  $("best-score-label").textContent = text.best;
  $("play-again").textContent = text.playAgain;
}

function render() {
  const state = engine.state;
  $("hp-text").textContent = `${state.currentHp} / ${state.maxHp}`;
  $("wave").textContent = String(state.wave);
  $("score").textContent = String(state.score);
  $("total-hp-text").textContent = `${state.currentHp} / ${state.maxHp}`;
  const hpRatio = Math.max(0, Math.min(1, state.currentHp / state.maxHp));
  $("hp-fill").style.width = `${hpRatio * 100}%`;
  $("hp-fill").classList.toggle("danger", hpRatio < .25);
  renderBoard(boardEl, state.board);
  renderWeaponStrip($("weapon-strip"), state.board);
  renderBattle(canvas, state);

  if (state.bossWarning) {
    $("boss-warning").hidden = false;
    $("boss-warning").firstChild.textContent = `${text.bossWarning} `;
    $("boss-countdown").textContent = `${Math.max(0, state.bossWarning.remainingSeconds).toFixed(1)}s`;
  } else $("boss-warning").hidden = true;

  if (state.gameOverReason) {
    gameOverEl.hidden = false;
    $("game-over-reason").textContent = state.gameOverReason === "BOARD_STUCK" ? text.boardStuck : text.hpZero;
    $("final-score").textContent = String(state.score);
    $("best-score").textContent = String(Math.max(bestScore, state.score));
  } else gameOverEl.hidden = true;
}

async function saveProgress() {
  bestScore = Math.max(bestScore, engine.state.score);
  await bridge.save({ version: 1, bestScore, run: engine.serialize() });
}

async function reportGameOver() {
  if (gameOverReported || !engine.state.gameOverReason) return;
  gameOverReported = true;
  bestScore = Math.max(bestScore, engine.state.score);
  await saveProgress();
  await bridge.sendScore(bestScore);
}

function loop(timestamp) {
  if (paused) return;
  const delta = lastTime ? (timestamp - lastTime) / 1000 : 0;
  lastTime = timestamp;
  const beforeWave = engine.state.wave;
  const result = engine.tick(delta);
  render();
  if (engine.state.wave !== beforeWave || result.gameOver) saveProgress();
  if (result.gameOver) reportGameOver();
  raf = requestAnimationFrame(loop);
}

function startLoop() {
  cancelAnimationFrame(raf);
  lastTime = 0;
  if (!paused) raf = requestAnimationFrame(loop);
}

function newGame() {
  engine.reset();
  gameOverReported = false;
  render();
  saveProgress();
  boardEl.focus({ preventScroll: true });
}

function move(direction) {
  if (paused || engine.state.gameOverReason) return;
  const result = engine.move(direction);
  if (!result.changed) return;
  render();
  saveProgress();
  if (result.gameOver) reportGameOver();
}

function installInput() {
  const keyMap = { ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT", w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT", W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT" };
  boardEl.addEventListener("keydown", (event) => {
    const direction = keyMap[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });
  document.addEventListener("keydown", (event) => {
    if (document.activeElement === boardEl) return;
    const direction = keyMap[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });

  let start = null;
  boardEl.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    boardEl.setPointerCapture(event.pointerId);
  });
  boardEl.addEventListener("pointerup", (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.hypot(dx, dy) < 24) return;
    move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP"));
  });
  boardEl.addEventListener("pointercancel", () => { start = null; });

  $("restart").addEventListener("click", newGame);
  $("play-again").addEventListener("click", newGame);
}

async function initialize() {
  bridge.firstFrameReady();
  const [locale, saved] = await Promise.all([bridge.getLanguage(), bridge.load()]);
  text = strings(locale);
  applyStrings();
  if (saved && typeof saved === "object") {
    bestScore = Math.max(0, Number(saved.bestScore) || 0);
    if (saved.run) engine.restore(saved.run);
  }
  if (engine.state.gameOverReason) {
    engine.reset();
    gameOverReported = false;
  }
  installInput();
  bridge.installSystemHandlers({
    onPause: () => {
      paused = true;
      cancelAnimationFrame(raf);
      saveProgress();
    },
    onResume: () => {
      paused = false;
      startLoop();
    },
  });
  loading.hidden = true;
  app.hidden = false;
  render();
  bridge.gameReady();
  boardEl.focus({ preventScroll: true });
  startLoop();
}

initialize().catch(() => {
  loading.textContent = "Unable to start 2048TD";
});
