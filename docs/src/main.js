import { GameEngine } from "./game_engine.js?v=fever-aura-lite-2";
import { PlayablesBridge } from "./playables.js?v=youtube-platform-1";
import { strings } from "./i18n.js?v=board-style-1";
import { renderBattle, renderBoard, renderComboFever, renderWeaponStrip } from "./renderer.js?v=fever-aura-lite-2";
import { isLandscapeViewport, screenDirectionToLogical } from "./orientation.js";
import { feverActive } from "./combo_fever.js";
import { BoardStyle, LandscapeHand, normalizePreferences } from "./preferences.js?v=board-style-3";
import { setSfxPreferences } from "./audio.js?v=youtube-platform-1";
import { setBgmPreferences } from "./bgm.js?v=youtube-platform-1";

const WEB_APP_VERSION = "0.1.7";
const WEB_VERSION_CODE = 8;

const bridge = new PlayablesBridge();
const engine = new GameEngine();
let bestScore = 0;
let systemPaused = false;
let settingsOpen = false;
let preferences = normalizePreferences(null);
let ranking = null;
let raf = 0;
let lastTime = 0;
let text = strings("en-US");
let gameOverReported = false;
let lastComboEventId = 0;
let lastFeverCount = 0;
let wasFeverActive = false;
let lastLandscape = null;
let transitionTimer = 0;

const $ = (id) => document.getElementById(id);
const app = $("app");
const loading = $("loading");
const canvas = $("battlefield");
const boardEl = $("board");
const gameOverEl = $("game-over");
const comboHud = $("combo-hud");
const feverTransition = $("fever-transition");
const settingsOverlay = $("settings-overlay");

function landscapeNow() {
  return isLandscapeViewport(globalThis.innerWidth, globalThis.innerHeight);
}

function applyStrings() {
  $("settings-button").setAttribute("aria-label", text.settings);
  $("settings-close").setAttribute("aria-label", text.closeSettings);
  $("settings-backdrop").setAttribute("aria-label", text.closeSettings);
  $("hp-label").textContent = text.hp;
  $("wave-label").textContent = text.wave;
  $("score-label").textContent = text.score;
  $("hint").textContent = text.hint;
  $("game-over-title").textContent = text.gameOver;
  $("final-score-label").textContent = text.finalScore;
  $("best-score-label").textContent = text.best;
  $("play-again").textContent = text.playAgain;
  $("settings-kicker").textContent = text.settingsKicker;
  $("settings-title").textContent = text.settings;
  $("landscape-hand-title").textContent = text.landscapeLayout;
  $("landscape-hand-description").textContent = text.landscapeDescription;
  $("hand-left-title").textContent = text.leftHand;
  $("hand-left-description").textContent = text.leftHandDescription;
  $("hand-right-title").textContent = text.rightHand;
  $("hand-right-description").textContent = text.rightHandDescription;
  $("portrait-unchanged").textContent = text.portraitUnchanged;
  $("board-style-title").textContent = text.boardStyle;
  $("board-style-description").textContent = text.boardStyleDescription;
  $("board-style-classic-label").textContent = text.boardStyleClassic;
  $("board-style-modern-label").textContent = text.boardStyleModern;
  $("board-style-sf-label").textContent = text.boardStyleSf;
  $("sound-effects-title").textContent = text.soundEffects;
  $("sound-effects-description").textContent = text.soundEffectsDescription;
  $("sound-effects-volume-label").textContent = text.soundEffectsVolume;
  $("background-music-title").textContent = text.backgroundMusic;
  $("background-music-description").textContent = text.backgroundMusicDescription;
  $("background-music-volume-label").textContent = text.backgroundMusicVolume;
  $("settings-restart").textContent = text.restartGame;
  $("settings-done").textContent = text.done;
  ranking?.setText(text);
}

function gamePaused() {
  return systemPaused || settingsOpen || Boolean(ranking?.isOpen);
}

function updatePreferenceUi() {
  const rightHand = preferences.landscapeHand === LandscapeHand.RIGHT;
  app.classList.toggle("handed-right", rightHand);
  $("hand-left").setAttribute("aria-checked", String(!rightHand));
  $("hand-right").setAttribute("aria-checked", String(rightHand));
  $("landscape-flow-label").textContent = rightHand ? "ENEMY →" : "← ENEMY";

  const boardStyle = preferences.boardStyle;
  app.classList.toggle("board-style-modern", boardStyle === BoardStyle.MODERN);
  app.classList.toggle("board-style-sf", boardStyle === BoardStyle.SF);
  $("board-style-classic").setAttribute("aria-checked", String(boardStyle === BoardStyle.CLASSIC));
  $("board-style-modern").setAttribute("aria-checked", String(boardStyle === BoardStyle.MODERN));
  $("board-style-sf").setAttribute("aria-checked", String(boardStyle === BoardStyle.SF));

  const soundToggle = $("sound-effects-toggle");
  const volume = Math.round(preferences.sfxVolume * 100);
  soundToggle.setAttribute("aria-checked", String(preferences.sfxEnabled));
  $("sound-effects-toggle-label").textContent = preferences.sfxEnabled ? text.soundEffectsOn : text.soundEffectsOff;
  $("sound-effects-volume").value = String(volume);
  $("sound-effects-volume").setAttribute("aria-valuenow", String(volume));
  $("sound-effects-volume-value").textContent = `${volume}%`;
  setSfxPreferences(preferences);

  const bgmToggle = $("background-music-toggle");
  const bgmVolume = Math.round(preferences.bgmVolume * 100);
  bgmToggle.setAttribute("aria-checked", String(preferences.bgmEnabled));
  $("background-music-toggle-label").textContent = preferences.bgmEnabled ? text.backgroundMusicOn : text.backgroundMusicOff;
  $("background-music-volume").value = String(bgmVolume);
  $("background-music-volume").setAttribute("aria-valuenow", String(bgmVolume));
  $("background-music-volume-value").textContent = `${bgmVolume}%`;
  setBgmPreferences(preferences);
}

function setLandscapeHand(hand) {
  preferences = normalizePreferences({ ...preferences, landscapeHand: hand });
  updatePreferenceUi();
  render();
  saveProgress();
}

function setBoardStyle(boardStyle) {
  preferences = normalizePreferences({ ...preferences, boardStyle });
  updatePreferenceUi();
  saveProgress();
}

function setSoundEffectsEnabled(enabled) {
  preferences = normalizePreferences({ ...preferences, sfxEnabled: enabled });
  updatePreferenceUi();
  saveProgress();
}

function setSoundEffectsVolume(percent, persist) {
  preferences = normalizePreferences({ ...preferences, sfxVolume: Number(percent) / 100 });
  updatePreferenceUi();
  if (persist) saveProgress();
}

function setBackgroundMusicEnabled(enabled) {
  preferences = normalizePreferences({ ...preferences, bgmEnabled: enabled });
  updatePreferenceUi();
  saveProgress();
}

function setBackgroundMusicVolume(percent, persist) {
  preferences = normalizePreferences({ ...preferences, bgmVolume: Number(percent) / 100 });
  updatePreferenceUi();
  if (persist) saveProgress();
}

function openSettings() {
  if (settingsOpen || ranking?.isOpen) return;
  settingsOpen = true;
  cancelAnimationFrame(raf);
  settingsOverlay.hidden = false;
  updatePreferenceUi();
  $(preferences.landscapeHand === LandscapeHand.RIGHT ? "hand-right" : "hand-left").focus({ preventScroll: true });
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  settingsOverlay.hidden = true;
  startLoop();
  boardEl.focus({ preventScroll: true });
}

function showComboIfNeeded(state) {
  const cf = state.comboFever;
  if (cf.comboEventId <= lastComboEventId) return;
  lastComboEventId = cf.comboEventId;
  if (cf.combo <= 0) return;
  $("combo-number").textContent = String(cf.combo);
  comboHud.hidden = false;
  comboHud.style.animation = "none";
  void comboHud.offsetWidth;
  comboHud.style.animation = "";
}

comboHud.addEventListener("animationend", () => { comboHud.hidden = true; });

function showFeverTransition(label, ending = false) {
  clearTimeout(transitionTimer);
  feverTransition.textContent = label;
  feverTransition.classList.toggle("end", ending);
  feverTransition.hidden = false;
  feverTransition.style.animation = "none";
  void feverTransition.offsetWidth;
  feverTransition.style.animation = "";
  transitionTimer = setTimeout(() => { feverTransition.hidden = true; }, ending ? 520 : 760);
}

function handleFeverTransitions(state) {
  const cf = state.comboFever;
  const active = feverActive(cf);
  if (cf.feverCount > lastFeverCount) {
    lastFeverCount = cf.feverCount;
    showFeverTransition("FEVER", false);
  } else if (wasFeverActive && !active && cf.feverCount > 0) {
    showFeverTransition("FEVER END", true);
  }
  wasFeverActive = active;
}

function render() {
  const state = engine.state;
  const landscape = landscapeNow();
  if (landscape !== lastLandscape) {
    lastLandscape = landscape;
    app.classList.toggle("landscape-layout", landscape);
  }

  $("hp-text").textContent = `${state.currentHp}/${state.maxHp}`;
  $("wave").textContent = String(state.wave);
  $("score").textContent = String(state.score);
  const hpRatio = Math.max(0, Math.min(1, state.currentHp / state.maxHp));
  $("hp-fill").style.width = `${hpRatio * 100}%`;
  $("hp-fill").classList.toggle("danger", hpRatio < .25);

  renderBoard(boardEl, state.board, landscape);
  renderWeaponStrip($("weapon-strip"), state.board);
  renderBattle(canvas, state, landscape, preferences.landscapeHand);
  renderComboFever(app, state);
  showComboIfNeeded(state);
  handleFeverTransitions(state);

  if (state.bossWarning) {
    $("boss-warning").hidden = false;
    $("boss-warning").firstChild.textContent = `${text.bossWarning} `;
    $("boss-countdown").textContent = `${Math.max(0, state.bossWarning.remainingSeconds).toFixed(1)}s`;
  } else {
    $("boss-warning").hidden = true;
  }

  if (state.gameOverReason) {
    gameOverEl.hidden = false;
    $("game-over-reason").textContent = state.gameOverReason === "BOARD_STUCK" ? text.boardStuck : text.hpZero;
    $("final-score").textContent = String(state.score);
    $("best-score").textContent = String(Math.max(bestScore, state.score));
  } else {
    gameOverEl.hidden = true;
  }
}

async function saveProgress() {
  bestScore = Math.max(bestScore, engine.state.score);
  await bridge.save({
    version: 4,
    bestScore,
    settings: preferences,
    run: engine.serialize(),
    ranking: ranking?.snapshot() ?? null,
  });
}

async function reportGameOver() {
  if (gameOverReported || !engine.state.gameOverReason) return;
  gameOverReported = true;
  const completedState = engine.snapshot();
  bestScore = Math.max(bestScore, completedState.score);
  await saveProgress();
  await Promise.allSettled([
    bridge.sendScore(bestScore),
    ranking?.reportGameOver(completedState),
  ]);
  await saveProgress();
}

function loop(timestamp) {
  if (gamePaused()) return;
  const delta = lastTime ? (timestamp - lastTime) / 1000 : 0;
  lastTime = timestamp;
  const beforeWave = engine.state.wave;
  const result = engine.tick(delta);
  render();
  if (engine.state.wave !== beforeWave || result.scoreChanged || result.gameOver) saveProgress();
  if (result.gameOver) reportGameOver();
  raf = requestAnimationFrame(loop);
}

function startLoop() {
  cancelAnimationFrame(raf);
  lastTime = 0;
  if (!gamePaused()) raf = requestAnimationFrame(loop);
}

function syncUiEventBaselines() {
  lastComboEventId = engine.state.comboFever.comboEventId;
  lastFeverCount = engine.state.comboFever.feverCount;
  wasFeverActive = feverActive(engine.state.comboFever);
}

function newGame() {
  engine.reset();
  gameOverReported = false;
  ranking?.newGame();
  syncUiEventBaselines();
  render();
  saveProgress();
  boardEl.focus({ preventScroll: true });
}

function moveScreenDirection(screenDirection) {
  if (gamePaused() || engine.state.gameOverReason) return;
  const logicalDirection = screenDirectionToLogical(screenDirection, landscapeNow());
  const result = engine.move(logicalDirection);
  if (!result.changed) return;
  render();
  saveProgress();
  if (result.gameOver) reportGameOver();
}

function installInput() {
  const keyMap = {
    ArrowUp: "UP", ArrowDown: "DOWN", ArrowLeft: "LEFT", ArrowRight: "RIGHT",
    w: "UP", s: "DOWN", a: "LEFT", d: "RIGHT",
    W: "UP", S: "DOWN", A: "LEFT", D: "RIGHT",
  };
  const handleKey = (event) => {
    const direction = keyMap[event.key];
    if (!direction) return;
    event.preventDefault();
    moveScreenDirection(direction);
  };
  boardEl.addEventListener("keydown", handleKey);
  document.addEventListener("keydown", (event) => {
    if (settingsOpen || ranking?.isOpen || document.activeElement === boardEl) return;
    handleKey(event);
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
    moveScreenDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "RIGHT" : "LEFT") : (dy > 0 ? "DOWN" : "UP"));
  });
  boardEl.addEventListener("pointercancel", () => { start = null; });

  $("settings-button").addEventListener("click", openSettings);
  $("settings-close").addEventListener("click", closeSettings);
  $("settings-backdrop").addEventListener("click", closeSettings);
  $("settings-done").addEventListener("click", closeSettings);
  $("settings-restart").addEventListener("click", () => {
    newGame();
    closeSettings();
  });
  $("hand-left").addEventListener("click", () => setLandscapeHand(LandscapeHand.LEFT));
  $("hand-right").addEventListener("click", () => setLandscapeHand(LandscapeHand.RIGHT));
  $("board-style-classic").addEventListener("click", () => setBoardStyle(BoardStyle.CLASSIC));
  $("board-style-modern").addEventListener("click", () => setBoardStyle(BoardStyle.MODERN));
  $("board-style-sf").addEventListener("click", () => setBoardStyle(BoardStyle.SF));
  $("sound-effects-toggle").addEventListener("click", () => setSoundEffectsEnabled(!preferences.sfxEnabled));
  $("sound-effects-volume").addEventListener("input", (event) => setSoundEffectsVolume(event.currentTarget.value, false));
  $("sound-effects-volume").addEventListener("change", (event) => setSoundEffectsVolume(event.currentTarget.value, true));
  $("background-music-toggle").addEventListener("click", () => setBackgroundMusicEnabled(!preferences.bgmEnabled));
  $("background-music-volume").addEventListener("input", (event) => setBackgroundMusicVolume(event.currentTarget.value, false));
  $("background-music-volume").addEventListener("change", (event) => setBackgroundMusicVolume(event.currentTarget.value, true));
  $("play-again").addEventListener("click", newGame);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || ranking?.isOpen) return;
    if (settingsOpen) {
      event.preventDefault();
      closeSettings();
    }
  });
  globalThis.addEventListener("resize", render, { passive: true });
  globalThis.addEventListener("orientationchange", () => setTimeout(render, 60), { passive: true });
}

function hideStandaloneRankingUi() {
  $("ranking-button").hidden = true;
  $("game-over-ranking").hidden = true;
  $("game-over-rank-card").hidden = true;
}

async function initializeRanking(saved) {
  if (bridge.inYouTube) {
    hideStandaloneRankingUi();
    return;
  }
  const { WebRankingController } = await import("./ranking.js?v=standalone-ranking-1");
  ranking = new WebRankingController({
    enabled: true,
    text,
    appVersion: WEB_APP_VERSION,
    versionCode: WEB_VERSION_CODE,
    onOpenChange: (open) => {
      if (open) cancelAnimationFrame(raf);
      else startLoop();
    },
    onPersist: () => { void saveProgress(); },
  });
  ranking.restore(saved?.ranking);
}

async function initialize() {
  bridge.firstFrameReady();
  const [locale, saved] = await Promise.all([bridge.getLanguage(), bridge.load()]);
  text = strings(locale);
  await initializeRanking(saved);
  applyStrings();
  if (saved && typeof saved === "object") {
    bestScore = Math.max(0, Number(saved.bestScore) || 0);
    preferences = normalizePreferences(saved.settings);
    if (saved.run) engine.restore(saved.run);
  }
  updatePreferenceUi();
  installInput();
  ranking?.install();
  if (engine.state.gameOverReason) {
    engine.reset();
    gameOverReported = false;
    ranking?.newGame();
  } else if (ranking) {
    void ranking.ensureRun();
  }
  syncUiEventBaselines();
  bridge.installSystemHandlers({
    onPause: () => {
      systemPaused = true;
      cancelAnimationFrame(raf);
      saveProgress();
    },
    onResume: () => {
      systemPaused = false;
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

initialize().catch((error) => {
  console.error(error);
  loading.textContent = "Unable to start 2048TD";
});