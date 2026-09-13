import { recordPersonalResult, snapshotPersonalRanking } from "./personal_ranking.js?v=personal-ranking-1";

const API_BASE = "https://2048td-ranking.yukigbr3100.workers.dev";
const RULESET_VERSION = 1;
const DEFAULT_DISPLAY_NAME = "PLAYER";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const $ = (id) => document.getElementById(id);
const scoreFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function formatScore(value) {
  return scoreFormatter.format(Math.max(0, Math.trunc(Number(value) || 0)));
}

function formatDate(value) {
  const timestamp = Number(value) || 0;
  if (!timestamp) return "";
  try { return dateFormatter.format(new Date(timestamp)); } catch { return ""; }
}

function createUuidV4() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function element(tag, className, textContent = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = textContent;
  return node;
}

function maxTile(board) {
  return Math.max(2, ...(Array.isArray(board) ? board.map((value) => Math.max(0, Number(value) || 0)) : [2]));
}

function ensurePersonalStyles() {
  if ($("web-personal-ranking-style")) return;
  const style = document.createElement("style");
  style.id = "web-personal-ranking-style";
  style.textContent = `
    .ranking-my-view.personal-records-view{display:block;overflow-y:auto;padding:14px;overscroll-behavior:contain}
    .ranking-my-view.personal-records-view .ranking-my-card{margin:0 auto 12px}
    .personal-ranking-list{width:min(100%,500px);margin:0 auto 12px}
    .personal-ranking-list .ranking-entry{grid-template-columns:48px minmax(0,1fr) auto}
  `;
  document.head.append(style);
}

export class WebRankingController {
  constructor({ enabled, text, appVersion, versionCode, onOpenChange, onPersist }) {
    this.enabled = Boolean(enabled);
    this.globalEnabled = Boolean(enabled && typeof fetch === "function");
    this.text = text;
    this.appVersion = appVersion;
    this.versionCode = versionCode;
    this.onOpenChange = onOpenChange;
    this.onPersist = onPersist;
    this.playerId = createUuidV4();
    this.runState = { runId: null, startPromise: null };
    this.opened = false;
    this.activeTab = "mine";
    this.installed = false;
    this.lastTop = [];
    this.lastPlayerRank = null;
  }

  get isOpen() {
    return this.opened;
  }

  restore(saved) {
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.playerId === "string" && UUID_V4.test(saved.playerId)) {
      this.playerId = saved.playerId;
    }
    this.runState = {
      runId: typeof saved.runId === "string" && UUID_V4.test(saved.runId) ? saved.runId : null,
      startPromise: null,
    };
  }

  snapshot() {
    return {
      playerId: this.playerId,
      runId: this.runState.runId,
    };
  }

  install() {
    if (this.installed) return;
    this.installed = true;
    const rankingButton = $("ranking-button");
    const gameOverRanking = $("game-over-ranking");
    const gameOverRankCard = $("game-over-rank-card");
    rankingButton.hidden = !this.enabled;
    gameOverRanking.hidden = !this.enabled;
    gameOverRankCard.hidden = !this.enabled;
    if (!this.enabled) return;

    ensurePersonalStyles();
    this.configurePersonalView();
    rankingButton.addEventListener("click", () => this.open("mine"));
    gameOverRanking.addEventListener("click", () => this.open("mine"));
    $("ranking-close").addEventListener("click", () => this.close());
    $("ranking-backdrop").addEventListener("click", () => this.close());
    $("ranking-refresh").addEventListener("click", () => this.refresh());
    $("ranking-tab-top").addEventListener("click", () => this.selectTab("top"));
    $("ranking-tab-mine").addEventListener("click", () => this.selectTab("mine"));
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !this.opened) return;
      event.preventDefault();
      this.close();
    });
    this.applyStrings();
    this.renderPersonalRecords();
    this.resetGameOverRank();
  }

  configurePersonalView() {
    const view = $("ranking-my-view");
    if (!view) return;
    view.classList.add("personal-records-view");
    view.innerHTML = `
      <div class="ranking-my-card">
        <span id="ranking-my-rank-label" class="ranking-my-rank-label"></span>
        <strong id="ranking-my-rank" class="ranking-my-rank">0</strong>
        <p id="ranking-my-total" class="ranking-my-total"></p>
        <div class="ranking-my-stats">
          <div class="ranking-my-stat"><span id="ranking-my-best-label"></span><strong id="ranking-my-best">0</strong></div>
          <div class="ranking-my-stat"><span id="ranking-my-wave-label"></span><strong id="ranking-my-wave">-</strong></div>
          <div class="ranking-my-stat"><span id="ranking-my-tile-label"></span><strong id="ranking-my-tile">-</strong></div>
        </div>
      </div>
      <div id="ranking-my-list" class="ranking-list personal-ranking-list"></div>`;
  }

  setText(text) {
    this.text = text;
    if (this.installed && this.enabled) {
      this.applyStrings();
      this.renderPersonalRecords();
    }
  }

  applyStrings() {
    $("ranking-button").setAttribute("aria-label", this.text.openRanking);
    $("ranking-close").setAttribute("aria-label", this.text.closeRanking);
    $("ranking-backdrop").setAttribute("aria-label", this.text.closeRanking);
    $("ranking-refresh").setAttribute("aria-label", this.text.refreshRanking);
    $("ranking-title").textContent = this.text.ranking;
    $("ranking-tab-top").textContent = this.text.top100;
    $("ranking-tab-mine").textContent = this.text.myRecords ?? this.text.myRank;
    $("ranking-you-label").textContent = this.text.you;
    $("ranking-my-rank-label").textContent = this.text.personalBest ?? this.text.best;
    $("ranking-my-best-label").textContent = this.text.games ?? "GAMES";
    $("ranking-my-wave-label").textContent = this.text.wave;
    $("ranking-my-tile-label").textContent = this.text.maxTile;
    $("global-rank-label").textContent = this.text.personalRank ?? this.text.myRank;
    $("game-over-ranking").textContent = this.text.ranking;
    this.updateKicker();
  }

  updateKicker() {
    const kicker = $("ranking-kicker");
    if (!kicker) return;
    kicker.textContent = this.activeTab === "mine"
      ? (this.text.myRecords ?? this.text.myRank)
      : this.text.globalRank;
  }

  async request(path, options = {}) {
    if (!this.globalEnabled) throw new Error("global ranking is unavailable in this environment");
    const headers = new Headers(options.headers ?? {});
    if (options.body !== undefined) headers.set("Content-Type", "application/json");
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    let body = null;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok || body?.ok !== true) {
      const code = body?.error?.code ?? `HTTP_${response.status}`;
      throw new Error(code);
    }
    return body;
  }

  async ensureRun(runState = this.runState) {
    if (!this.globalEnabled) return null;
    if (runState.runId) return runState.runId;
    if (runState.startPromise) return runState.startPromise;

    runState.startPromise = this.request("/v1/runs/start", {
      method: "POST",
      body: JSON.stringify({
        playerId: this.playerId,
        displayName: DEFAULT_DISPLAY_NAME,
        appVersion: this.appVersion,
        versionCode: this.versionCode,
        rulesetVersion: RULESET_VERSION,
      }),
    }).then((result) => {
      runState.runId = result.runId;
      if (runState === this.runState) this.onPersist?.();
      return result.runId;
    }).catch((error) => {
      console.warn("Unable to start global ranking run", error);
      return null;
    }).finally(() => {
      runState.startPromise = null;
    });

    return runState.startPromise;
  }

  newGame() {
    this.runState = { runId: null, startPromise: null };
    this.resetGameOverRank();
    if (this.opened) this.close();
    void this.ensureRun();
  }

  async reportGameOver(state) {
    if (!this.enabled) return null;

    const personal = recordPersonalResult({
      score: Math.max(0, Math.trunc(Number(state.score) || 0)),
      wave: Math.max(1, Math.trunc(Number(state.wave) || 1)),
      maxTile: maxTile(state.board),
      playedAt: Date.now(),
    });
    this.onPersist?.();
    this.setGameOverPersonalRank(personal);
    this.renderPersonalRecords();

    if (!this.globalEnabled) return { personal, global: null };

    const submittedRun = this.runState;
    const runId = submittedRun.runId ?? await this.ensureRun(submittedRun);
    if (!runId) return { personal, global: null };

    try {
      const result = await this.request("/v1/runs/finish", {
        method: "POST",
        body: JSON.stringify({
          runId,
          playerId: this.playerId,
          score: Math.max(0, Math.trunc(Number(state.score) || 0)),
          wave: Math.max(1, Math.trunc(Number(state.wave) || 1)),
          maxTile: maxTile(state.board),
          elapsedMs: Math.max(0, Math.trunc((Number(state.elapsedSeconds) || 0) * 1000)),
          gameOverReason: state.gameOverReason,
          appVersion: this.appVersion,
          versionCode: this.versionCode,
          rulesetVersion: RULESET_VERSION,
        }),
      });
      submittedRun.runId = null;
      if (submittedRun === this.runState) this.onPersist?.();
      this.lastPlayerRank = result;
      if (this.opened && this.activeTab === "top") void this.refresh();
      return { personal, global: result };
    } catch (error) {
      console.warn("Unable to submit global ranking score; personal result is already saved", error);
      return { personal, global: null };
    }
  }

  resetGameOverRank() {
    if (!this.enabled || !$("game-over-rank")) return;
    $("global-rank-label").textContent = this.text.personalRank ?? this.text.myRank;
    $("game-over-rank").textContent = "---";
    $("game-over-rank-status").textContent = this.text.playToRank;
    $("game-over-rank-card").classList.remove("updated", "unavailable");
  }

  setGameOverPersonalRank(result) {
    $("global-rank-label").textContent = this.text.personalRank ?? this.text.myRank;
    $("game-over-rank").textContent = result.rank == null ? "—" : `#${result.rank}`;
    $("game-over-rank-status").textContent = result.isBest
      ? this.text.newPersonalBest
      : `${this.text.personalBest ?? this.text.best} ${formatScore(result.bestScore)}`;
    $("game-over-rank-card").classList.add("updated");
    $("game-over-rank-card").classList.remove("unavailable");
  }

  async open(tab = "mine") {
    if (!this.enabled || this.opened) return;
    this.opened = true;
    $("ranking-overlay").hidden = false;
    this.onOpenChange?.(true);
    this.selectTab(tab, false);
    $("ranking-close").focus({ preventScroll: true });
    await this.refresh();
  }

  close() {
    if (!this.opened) return;
    this.opened = false;
    $("ranking-overlay").hidden = true;
    this.onOpenChange?.(false);
    const gameOverVisible = !$("game-over").hidden;
    (gameOverVisible ? $("game-over-ranking") : $("ranking-button")).focus({ preventScroll: true });
  }

  selectTab(tab, refresh = true) {
    this.activeTab = tab === "top" ? "top" : "mine";
    const top = this.activeTab === "top";
    $("ranking-tab-top").classList.toggle("active", top);
    $("ranking-tab-mine").classList.toggle("active", !top);
    $("ranking-tab-top").setAttribute("aria-selected", String(top));
    $("ranking-tab-mine").setAttribute("aria-selected", String(!top));
    $("ranking-top-view").hidden = !top;
    $("ranking-my-view").hidden = top;
    $("ranking-refresh").hidden = !top;
    $("ranking-you-bar").hidden = false;
    this.updateKicker();
    if (!top) this.renderPersonalRecords();
    if (refresh && this.opened) void this.refresh();
  }

  async refresh() {
    if (!this.enabled || !this.opened) return;

    if (this.activeTab === "mine") {
      $("ranking-status").hidden = true;
      this.renderPersonalRecords();
      return;
    }

    const refreshButton = $("ranking-refresh");
    refreshButton.hidden = false;
    refreshButton.classList.add("loading");
    $("ranking-status").hidden = false;
    $("ranking-status").textContent = this.text.loadingRanking;

    try {
      const [topResult, rankResult] = await Promise.all([
        this.request(`/v1/leaderboard?rulesetVersion=${RULESET_VERSION}&limit=100`),
        this.request(`/v1/players/${encodeURIComponent(this.playerId)}/rank?rulesetVersion=${RULESET_VERSION}`),
      ]);
      this.lastTop = Array.isArray(topResult.entries) ? topResult.entries : [];
      this.lastPlayerRank = rankResult;
      this.renderTop(this.lastTop);
      this.renderGlobalFooter(rankResult);
      $("ranking-status").hidden = true;
    } catch (error) {
      console.warn("Unable to load global ranking", error);
      $("ranking-status").hidden = false;
      $("ranking-status").textContent = this.text.rankingUnavailable;
      $("ranking-list").replaceChildren();
    } finally {
      refreshButton.classList.remove("loading");
    }
  }

  renderTop(entries) {
    const list = $("ranking-list");
    list.replaceChildren();
    if (!entries.length) {
      list.append(element("div", "ranking-empty", this.text.noRankingEntries));
      return;
    }

    for (const entry of entries) {
      const row = element("div", "ranking-entry");
      const rank = Math.max(1, Math.trunc(Number(entry.rank) || 1));
      if (rank <= 3) row.classList.add(`rank-${rank}`);
      if (entry.playerId === this.playerId) row.classList.add("is-you");

      const rankNode = element("strong", "ranking-entry-rank", `#${rank}`);
      const identity = element("div", "ranking-entry-identity");
      identity.append(element("strong", "ranking-entry-name", entry.playerId === this.playerId ? this.text.you : String(entry.displayName || "Anonymous")));
      identity.append(element("small", "ranking-entry-meta", `${this.text.wave} ${Math.max(1, Number(entry.wave) || 1)} · ${this.text.maxTile} ${Math.max(2, Number(entry.maxTile) || 2)}`));
      const score = element("strong", "ranking-entry-score", formatScore(entry.score));
      row.append(rankNode, identity, score);
      list.append(row);
    }
  }

  renderPersonalRecords() {
    const personal = snapshotPersonalRanking();
    const records = Array.isArray(personal.records) ? personal.records : [];
    const bestScore = Math.max(Number(personal.legacyBestScore) || 0, Number(records[0]?.score) || 0);
    const bestRecord = records.find((record) => Number(record.score) === bestScore) ?? records[0] ?? null;
    const bestHasDetails = Boolean(bestRecord && !bestRecord.legacy);

    $("ranking-my-rank-label").textContent = this.text.personalBest ?? this.text.best;
    $("ranking-my-rank").textContent = formatScore(bestScore);
    $("ranking-my-best-label").textContent = this.text.games ?? "GAMES";
    $("ranking-my-best").textContent = formatScore(personal.totalGames ?? records.length);
    $("ranking-my-wave").textContent = bestHasDetails ? String(bestRecord.wave) : "-";
    $("ranking-my-tile").textContent = bestHasDetails ? formatScore(bestRecord.maxTile) : "-";
    $("ranking-my-total").textContent = records.length
      ? `${formatScore(records.length)} ${this.text.recordsSaved ?? "records saved"}`
      : this.text.playToRank;

    const list = $("ranking-my-list");
    if (list) {
      list.replaceChildren();
      if (!records.length) {
        list.append(element("div", "ranking-empty", this.text.playToRank));
      } else {
        records.forEach((record, index) => {
          const rank = index + 1;
          const row = element("div", "ranking-entry is-you");
          if (rank <= 3) row.classList.add(`rank-${rank}`);
          const rankNode = element("strong", "ranking-entry-rank", `#${rank}`);
          const identity = element("div", "ranking-entry-identity");
          const title = record.legacy
            ? (this.text.previousBest ?? this.text.personalBest ?? this.text.best)
            : `${this.text.wave} ${record.wave} · ${this.text.maxTile} ${formatScore(record.maxTile)}`;
          const meta = record.legacy
            ? (this.text.detailsUnavailable ?? "")
            : formatDate(record.playedAt);
          identity.append(element("strong", "ranking-entry-name", title));
          identity.append(element("small", "ranking-entry-meta", meta));
          const score = element("strong", "ranking-entry-score", formatScore(record.score));
          row.append(rankNode, identity, score);
          list.append(row);
        });
      }
    }

    const ranked = records.length > 0;
    $("ranking-you-rank").textContent = ranked ? "#1" : "---";
    $("ranking-you-score").textContent = formatScore(bestScore);
    $("ranking-you-total").textContent = ranked ? `/ ${formatScore(records.length)}` : "";
  }

  renderGlobalFooter(rankResult) {
    const ranked = rankResult?.rank != null;
    $("ranking-you-rank").textContent = ranked ? `#${rankResult.rank}` : this.text.unranked;
    $("ranking-you-score").textContent = ranked ? formatScore(rankResult.bestScore) : "---";
    $("ranking-you-total").textContent = ranked && rankResult.totalPlayers
      ? `/ ${formatScore(rankResult.totalPlayers)}`
      : "";
  }
}
