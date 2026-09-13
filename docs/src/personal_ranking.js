const MAX_RECORDS = 10;
const inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);
const listeners = new Set();

let state = {
  totalGames: 0,
  legacyBestScore: 0,
  records: [],
};

let locale = "en-US";
let installed = false;
let overlayOpen = false;
let pausedViaSettings = false;
let gameOverVisible = false;

const $ = (id) => document.getElementById(id);
const scoreFormatter = new Intl.NumberFormat("en-US");

const COPY = {
  en: {
    ranking: "RANKING",
    myRecords: "MY BEST 10",
    personalBest: "PERSONAL BEST",
    games: "GAMES",
    wave: "WAVE",
    maxTile: "MAX TILE",
    noRecords: "Finish a game to save your result here.",
    legacyBest: "Your previous best is preserved. Run details will be saved from your next game.",
    personalRank: "PERSONAL RANK",
    saved: "Saved to My Best 10",
    newBest: "NEW PERSONAL BEST",
    close: "Close ranking",
  },
  ja: {
    ranking: "ランキング",
    myRecords: "自己ベスト10",
    personalBest: "自己ベスト",
    games: "プレイ回数",
    wave: "WAVE",
    maxTile: "最大タイル",
    noRecords: "ゲーム終了後の成績がここに保存されます。",
    legacyBest: "以前のベストスコアは保持されています。詳細成績は次回プレイから保存されます。",
    personalRank: "自己成績順位",
    saved: "自己ベスト10に保存しました",
    newBest: "自己ベスト更新",
    close: "ランキングを閉じる",
  },
};

function copy() {
  return String(locale).toLowerCase().startsWith("ja") ? COPY.ja : COPY.en;
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(number(value, fallback));
}

function normalizeRecord(record, index = 0) {
  if (!record || typeof record !== "object") return null;
  const score = Math.max(0, integer(record.score));
  const wave = Math.max(1, integer(record.wave, 1));
  const maxTile = Math.max(2, integer(record.maxTile, 2));
  const playedAt = Math.max(0, integer(record.playedAt));
  const runNumber = Math.max(1, integer(record.runNumber, index + 1));
  return { runNumber, score, wave, maxTile, playedAt };
}

function sortRecords(records) {
  return records.sort((a, b) =>
    b.score - a.score ||
    b.wave - a.wave ||
    b.maxTile - a.maxTile ||
    b.playedAt - a.playedAt ||
    a.runNumber - b.runNumber,
  );
}

function bestScore() {
  return Math.max(state.legacyBestScore, state.records[0]?.score ?? 0);
}

function notify() {
  renderRanking();
  for (const listener of listeners) {
    try { listener(snapshotPersonalRanking()); } catch (error) { console.error(error); }
  }
}

export function restorePersonalRanking(saved, fallbackBestScore = 0) {
  const records = Array.isArray(saved?.records)
    ? saved.records.map(normalizeRecord).filter(Boolean)
    : [];
  sortRecords(records);
  const highestRun = records.reduce((max, record) => Math.max(max, record.runNumber), 0);
  state = {
    totalGames: Math.max(0, integer(saved?.totalGames), highestRun),
    legacyBestScore: Math.max(0, integer(fallbackBestScore), integer(saved?.legacyBestScore)),
    records: records.slice(0, MAX_RECORDS),
  };
  renderRanking();
}

export function snapshotPersonalRanking() {
  return {
    version: 1,
    totalGames: state.totalGames,
    legacyBestScore: state.legacyBestScore,
    records: state.records.map((record) => ({ ...record })),
  };
}

export function subscribePersonalRanking(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordPersonalResult({ score, wave, maxTile, playedAt = Date.now() }) {
  const previousBest = bestScore();
  const runNumber = state.totalGames + 1;
  const record = normalizeRecord({ runNumber, score, wave, maxTile, playedAt }, runNumber - 1);
  state.totalGames = runNumber;
  state.records.push(record);
  sortRecords(state.records);
  state.records = state.records.slice(0, MAX_RECORDS);
  state.legacyBestScore = Math.max(state.legacyBestScore, record.score);
  const rankIndex = state.records.findIndex((entry) => entry.runNumber === runNumber);
  const result = {
    rank: rankIndex >= 0 ? rankIndex + 1 : null,
    isBest: record.score > previousBest,
    bestScore: bestScore(),
    record,
  };
  notify();
  return result;
}

function formatScore(value) {
  return scoreFormatter.format(Math.max(0, integer(value)));
}

function formatPlayedAt(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat(locale, {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function buildRankingUi() {
  const overlay = $("ranking-overlay");
  const sheet = overlay?.querySelector(".ranking-sheet");
  if (!overlay || !sheet) return false;
  const t = copy();
  sheet.style.gridTemplateRows = "auto auto minmax(0, 1fr)";
  sheet.innerHTML = `
    <header class="ranking-header">
      <button id="personal-ranking-close" class="ranking-close" type="button" aria-label="${t.close}">←</button>
      <div class="ranking-header-copy">
        <span id="personal-ranking-kicker" class="ranking-kicker">${t.myRecords}</span>
        <h2 class="ranking-title">${t.ranking}</h2>
      </div>
      <span aria-hidden="true"></span>
    </header>
    <div class="ranking-my-view" style="height:auto;place-items:stretch;padding:14px 14px 8px">
      <div class="ranking-my-card" style="width:100%;padding:18px 16px 14px">
        <span id="personal-best-label" class="ranking-my-rank-label">${t.personalBest}</span>
        <strong id="personal-best-score" class="ranking-my-rank">0</strong>
        <p id="personal-games" class="ranking-my-total"></p>
        <div class="ranking-my-stats">
          <div class="ranking-my-stat"><span>${t.wave}</span><strong id="personal-best-wave">-</strong></div>
          <div class="ranking-my-stat"><span>${t.maxTile}</span><strong id="personal-best-tile">-</strong></div>
          <div class="ranking-my-stat"><span>${t.games}</span><strong id="personal-game-count">0</strong></div>
        </div>
      </div>
    </div>
    <div class="ranking-content">
      <div class="ranking-top-view" style="padding-top:6px">
        <div id="personal-ranking-list" class="ranking-list"></div>
      </div>
    </div>`;

  $("personal-ranking-close")?.addEventListener("click", closeRanking);
  $("ranking-backdrop")?.addEventListener("click", closeRanking);
  return true;
}

function renderRanking() {
  if (!installed) return;
  const t = copy();
  const best = bestScore();
  const bestRecord = state.records.find((record) => record.score === best) ?? state.records[0] ?? null;
  const bestScoreEl = $("personal-best-score");
  const gamesEl = $("personal-games");
  const countEl = $("personal-game-count");
  const waveEl = $("personal-best-wave");
  const tileEl = $("personal-best-tile");
  const list = $("personal-ranking-list");
  if (!bestScoreEl || !gamesEl || !countEl || !waveEl || !tileEl || !list) return;

  bestScoreEl.textContent = formatScore(best);
  countEl.textContent = formatScore(state.totalGames);
  gamesEl.textContent = `${t.games} ${formatScore(state.totalGames)}`;
  waveEl.textContent = bestRecord ? String(bestRecord.wave) : "-";
  tileEl.textContent = bestRecord ? formatScore(bestRecord.maxTile) : "-";
  list.replaceChildren();

  if (!state.records.length) {
    const empty = document.createElement("div");
    empty.className = "ranking-empty";
    empty.textContent = best > 0 ? t.legacyBest : t.noRecords;
    list.append(empty);
    return;
  }

  state.records.forEach((record, index) => {
    const row = document.createElement("div");
    row.className = "ranking-entry is-you";
    const rank = index + 1;
    if (rank <= 3) row.classList.add(`rank-${rank}`);

    const rankNode = document.createElement("strong");
    rankNode.className = "ranking-entry-rank";
    rankNode.textContent = `#${rank}`;

    const identity = document.createElement("div");
    identity.className = "ranking-entry-identity";
    const title = document.createElement("strong");
    title.className = "ranking-entry-name";
    title.textContent = `${t.wave} ${record.wave} · ${t.maxTile} ${formatScore(record.maxTile)}`;
    const meta = document.createElement("small");
    meta.className = "ranking-entry-meta";
    meta.textContent = formatPlayedAt(record.playedAt);
    identity.append(title, meta);

    const score = document.createElement("strong");
    score.className = "ranking-entry-score";
    score.textContent = formatScore(record.score);
    row.append(rankNode, identity, score);
    list.append(row);
  });
}

function pauseGameBehindRanking() {
  const gameOver = $("game-over");
  if (!gameOver?.hidden) return;
  const settingsOverlay = $("settings-overlay");
  const settingsButton = $("settings-button");
  if (!settingsOverlay || !settingsButton) return;
  settingsButton.click();
  if (!settingsOverlay.hidden) {
    pausedViaSettings = true;
    settingsOverlay.hidden = true;
  }
}

function resumeGameAfterRanking() {
  if (!pausedViaSettings) return;
  pausedViaSettings = false;
  $("settings-close")?.click();
}

function openRanking() {
  if (!installed || overlayOpen) return;
  pauseGameBehindRanking();
  overlayOpen = true;
  const overlay = $("ranking-overlay");
  if (!overlay) return;
  overlay.hidden = false;
  renderRanking();
  $("personal-ranking-close")?.focus({ preventScroll: true });
}

function closeRanking() {
  if (!overlayOpen) return;
  overlayOpen = false;
  const overlay = $("ranking-overlay");
  if (overlay) overlay.hidden = true;
  resumeGameAfterRanking();
  const gameOver = $("game-over");
  const target = gameOver && !gameOver.hidden ? $("game-over-ranking") : $("ranking-button");
  target?.focus({ preventScroll: true });
}

function captureGameOver() {
  const score = integer($("final-score")?.textContent);
  const wave = Math.max(1, integer($("wave")?.textContent, 1));
  const tiles = Array.from($("board")?.querySelectorAll(".tile") ?? []);
  const maxTile = Math.max(2, ...tiles.map((tile) => integer(tile.dataset.value, 0)));
  const result = recordPersonalResult({ score, wave, maxTile, playedAt: Date.now() });
  const t = copy();
  const label = $("global-rank-label");
  const rank = $("game-over-rank");
  const status = $("game-over-rank-status");
  if (label) label.textContent = t.personalRank;
  if (rank) rank.textContent = result.rank == null ? "—" : `#${result.rank}`;
  if (status) status.textContent = result.rank == null
    ? `${t.personalBest} ${formatScore(result.bestScore)}`
    : result.isBest ? t.newBest : `${t.personalBest} ${formatScore(result.bestScore)}`;
  $("game-over-rank-card")?.classList.add("updated");
}

function installGameOverObserver() {
  const gameOver = $("game-over");
  if (!gameOver) return;
  gameOverVisible = !gameOver.hidden;
  new MutationObserver(() => {
    const visible = !gameOver.hidden;
    if (visible && !gameOverVisible) captureGameOver();
    gameOverVisible = visible;
  }).observe(gameOver, { attributes: true, attributeFilter: ["hidden"] });
}

async function resolveLocale() {
  if (!inYouTube) return;
  try {
    locale = await globalThis.ytgame.system.getLanguage();
  } catch {
    locale = "en-US";
  }
  if (installed) {
    buildRankingUi();
    renderRanking();
  }
}

function activateAfterMainInitialization() {
  const app = $("app");
  if (!app || app.hidden) return false;
  if (installed) return true;
  installed = buildRankingUi();
  if (!installed) return false;

  const rankingButton = $("ranking-button");
  const gameOverRanking = $("game-over-ranking");
  const gameOverRankCard = $("game-over-rank-card");
  if (rankingButton) {
    rankingButton.hidden = false;
    rankingButton.addEventListener("click", openRanking);
  }
  if (gameOverRanking) {
    gameOverRanking.hidden = false;
    gameOverRanking.textContent = copy().ranking;
    gameOverRanking.addEventListener("click", openRanking);
  }
  if (gameOverRankCard) gameOverRankCard.hidden = false;
  renderRanking();
  return true;
}

function installUi() {
  if (!inYouTube) return;
  installGameOverObserver();
  void resolveLocale();
  if (activateAfterMainInitialization()) return;
  const app = $("app");
  if (!app) return;
  const observer = new MutationObserver(() => {
    if (!activateAfterMainInitialization()) return;
    observer.disconnect();
  });
  observer.observe(app, { attributes: true, attributeFilter: ["hidden"] });

  document.addEventListener("keydown", (event) => {
    if (!overlayOpen || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeRanking();
  }, true);
}

installUi();
