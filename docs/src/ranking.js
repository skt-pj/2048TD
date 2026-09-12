const API_BASE = "https://2048td-ranking.yukigbr3100.workers.dev";
const RULESET_VERSION = 1;
const DEFAULT_DISPLAY_NAME = "PLAYER";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const $ = (id) => document.getElementById(id);
const scoreFormatter = new Intl.NumberFormat("en-US");

function formatScore(value) {
  return scoreFormatter.format(Math.max(0, Math.trunc(Number(value) || 0)));
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

export class WebRankingController {
  constructor({ enabled, text, appVersion, versionCode, onOpenChange, onPersist }) {
    this.enabled = Boolean(enabled && typeof fetch === "function");
    this.text = text;
    this.appVersion = appVersion;
    this.versionCode = versionCode;
    this.onOpenChange = onOpenChange;
    this.onPersist = onPersist;
    this.playerId = createUuidV4();
    this.runState = { runId: null, startPromise: null };
    this.opened = false;
    this.activeTab = "top";
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

    rankingButton.addEventListener("click", () => this.open("top"));
    gameOverRanking.addEventListener("click", () => this.open("top"));
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
    this.resetGameOverRank();
  }

  setText(text) {
    this.text = text;
    if (this.installed && this.enabled) this.applyStrings();
  }

  applyStrings() {
    $("ranking-button").setAttribute("aria-label", this.text.openRanking);
    $("ranking-close").setAttribute("aria-label", this.text.closeRanking);
    $("ranking-backdrop").setAttribute("aria-label", this.text.closeRanking);
    $("ranking-refresh").setAttribute("aria-label", this.text.refreshRanking);
    $("ranking-kicker").textContent = this.text.globalRank;
    $("ranking-title").textContent = this.text.ranking;
    $("ranking-tab-top").textContent = this.text.top100;
    $("ranking-tab-mine").textContent = this.text.myRank;
    $("ranking-you-label").textContent = this.text.you;
    $("ranking-my-rank-label").textContent = this.text.globalRank;
    $("ranking-my-best-label").textContent = this.text.best;
    $("ranking-my-wave-label").textContent = this.text.wave;
    $("ranking-my-tile-label").textContent = this.text.maxTile;
    $("global-rank-label").textContent = this.text.globalRank;
    $("game-over-ranking").textContent = this.text.ranking;
  }

  async request(path, options = {}) {
    if (!this.enabled) throw new Error("ranking is unavailable in this environment");
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
    if (!this.enabled) return null;
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
      console.warn("Unable to start ranking run", error);
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
    const submittedRun = this.runState;
    this.setGameOverRankLoading();
    const runId = submittedRun.runId ?? await this.ensureRun(submittedRun);
    if (!runId) {
      this.setGameOverRankUnavailable();
      return null;
    }

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
      this.lastPlayerRank = {
        rank: result.rank,
        bestScore: result.bestScore,
      };
      this.setGameOverRank(result.rank, result.bestScore, result.bestUpdated);
      if (this.opened) void this.refresh();
      return result;
    } catch (error) {
      console.warn("Unable to submit ranking score", error);
      this.setGameOverRankUnavailable();
      return null;
    }
  }

  resetGameOverRank() {
    if (!this.enabled || !$("game-over-rank")) return;
    $("game-over-rank").textContent = "---";
    $("game-over-rank-status").textContent = this.text.updatingRank;
    $("game-over-rank-card").classList.remove("updated", "unavailable");
  }

  setGameOverRankLoading() {
    $("game-over-rank").textContent = "---";
    $("game-over-rank-status").textContent = this.text.updatingRank;
    $("game-over-rank-card").classList.remove("updated", "unavailable");
  }

  setGameOverRank(rank, bestScore, bestUpdated) {
    $("game-over-rank").textContent = rank == null ? this.text.unranked : `#${rank}`;
    $("game-over-rank-status").textContent = bestUpdated
      ? this.text.newPersonalBest
      : `${this.text.best} ${formatScore(bestScore)}`;
    $("game-over-rank-card").classList.add("updated");
    $("game-over-rank-card").classList.remove("unavailable");
  }

  setGameOverRankUnavailable() {
    $("game-over-rank").textContent = "---";
    $("game-over-rank-status").textContent = this.text.rankUnavailable;
    $("game-over-rank-card").classList.add("unavailable");
  }

  async open(tab = "top") {
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
    this.activeTab = tab === "mine" ? "mine" : "top";
    const top = this.activeTab === "top";
    $("ranking-tab-top").classList.toggle("active", top);
    $("ranking-tab-mine").classList.toggle("active", !top);
    $("ranking-tab-top").setAttribute("aria-selected", String(top));
    $("ranking-tab-mine").setAttribute("aria-selected", String(!top));
    $("ranking-top-view").hidden = !top;
    $("ranking-my-view").hidden = top;
    if (refresh && this.opened) void this.refresh();
  }

  async refresh() {
    if (!this.enabled || !this.opened) return;
    const refreshButton = $("ranking-refresh");
    refreshButton.classList.add("loading");
    $("ranking-status").hidden = false;
    $("ranking-status").textContent = this.text.loadingRanking;

    try {
      if (this.activeTab === "top") {
        const [topResult, rankResult] = await Promise.all([
          this.request(`/v1/leaderboard?rulesetVersion=${RULESET_VERSION}&limit=100`),
          this.request(`/v1/players/${encodeURIComponent(this.playerId)}/rank?rulesetVersion=${RULESET_VERSION}`),
        ]);
        this.lastTop = Array.isArray(topResult.entries) ? topResult.entries : [];
        this.lastPlayerRank = rankResult;
        this.renderTop(this.lastTop);
        this.renderPinnedRank(rankResult);
      } else {
        const rankResult = await this.request(`/v1/players/${encodeURIComponent(this.playerId)}/rank?rulesetVersion=${RULESET_VERSION}`);
        this.lastPlayerRank = rankResult;
        this.renderMine(rankResult);
        this.renderPinnedRank(rankResult);
      }
      $("ranking-status").hidden = true;
    } catch (error) {
      console.warn("Unable to load ranking", error);
      $("ranking-status").hidden = false;
      $("ranking-status").textContent = this.text.rankingUnavailable;
      if (this.activeTab === "top") $("ranking-list").replaceChildren();
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

  renderMine(rankResult) {
    const ranked = rankResult?.rank != null;
    $("ranking-my-rank").textContent = ranked ? `#${rankResult.rank}` : this.text.unranked;
    $("ranking-my-best").textContent = ranked ? formatScore(rankResult.bestScore) : "---";
    $("ranking-my-wave").textContent = ranked ? String(rankResult.wave ?? "-") : "-";
    $("ranking-my-tile").textContent = ranked ? String(rankResult.maxTile ?? "-") : "-";
    $("ranking-my-total").textContent = ranked && rankResult.totalPlayers
      ? `${this.text.outOf} ${formatScore(rankResult.totalPlayers)}`
      : this.text.playToRank;
  }

  renderPinnedRank(rankResult) {
    const ranked = rankResult?.rank != null;
    $("ranking-you-rank").textContent = ranked ? `#${rankResult.rank}` : this.text.unranked;
    $("ranking-you-score").textContent = ranked ? formatScore(rankResult.bestScore) : "---";
    $("ranking-you-total").textContent = ranked && rankResult.totalPlayers
      ? `/ ${formatScore(rankResult.totalPlayers)}`
      : "";
    this.renderMine(rankResult);
  }
}
