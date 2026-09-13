import { setPlatformAudioEnabled, setPlatformPaused } from "./platform_state.js";
import {
  restorePersonalRanking,
  snapshotPersonalRanking,
  subscribePersonalRanking,
} from "./personal_ranking.js?v=personal-ranking-1";

const LOCAL_SAVE_KEY = "2048td-playables-preview-save";

export class PlayablesBridge {
  constructor() {
    this.inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);
    this.loaded = false;
    this.paused = false;
    this.pendingSave = null;
    this.savePromise = null;
    this.lastSaveData = null;
    this.savedBestScore = 0;
    this.scoreTarget = 0;
    this.lastSentScore = 0;
    this.scorePromise = null;
    this.unsubscribePersonalRanking = subscribePersonalRanking(() => {
      if (!this.loaded || !this.lastSaveData) return;
      void this.save(this.lastSaveData);
    });
  }

  firstFrameReady() {
    if (this.inYouTube) globalThis.ytgame.game.firstFrameReady();
  }

  gameReady() {
    if (!this.inYouTube) return;
    globalThis.ytgame.game.gameReady();
    void this.flushScore();
  }

  async getLanguage() {
    if (this.inYouTube) {
      try { return await globalThis.ytgame.system.getLanguage(); } catch { return "en-US"; }
    }
    const query = new URLSearchParams(globalThis.location?.search ?? "");
    return query.get("lang") === "ja" ? "ja-JP" : "en-US";
  }

  async load() {
    let raw = "";
    if (this.inYouTube) {
      try { raw = await globalThis.ytgame.game.loadData(); } catch { raw = ""; }
    } else {
      try { raw = globalThis.localStorage?.getItem(LOCAL_SAVE_KEY) ?? ""; } catch { raw = ""; }
    }
    this.loaded = true;
    if (!raw) {
      restorePersonalRanking(null, 0);
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      restorePersonalRanking(parsed?.personalRanking, parsed?.bestScore);
      this.lastSaveData = parsed && typeof parsed === "object" ? { ...parsed } : null;
      if (this.inYouTube) {
        this.savedBestScore = Math.max(0, Math.trunc(Number(parsed?.bestScore) || 0));
        this.scoreTarget = Math.max(this.scoreTarget, this.savedBestScore);
      }
      return parsed;
    } catch {
      restorePersonalRanking(null, 0);
      return null;
    }
  }

  async flushSaves() {
    if (!this.inYouTube || this.savePromise) return this.savePromise ?? true;
    this.savePromise = (async () => {
      let success = true;
      while (this.pendingSave !== null) {
        const current = this.pendingSave;
        this.pendingSave = null;
        try {
          await globalThis.ytgame.game.saveData(current.raw);
          this.savedBestScore = Math.max(this.savedBestScore, current.bestScore);
          this.scoreTarget = Math.max(this.scoreTarget, this.savedBestScore);
        } catch (error) {
          if (this.pendingSave === null) this.pendingSave = current;
          console.warn("Unable to save Playables data", error);
          success = false;
          break;
        }
      }
      if (success && !this.paused) await this.flushScore();
      return success;
    })().finally(() => {
      this.savePromise = null;
    });
    return this.savePromise;
  }

  async save(data) {
    if (!this.loaded) return false;
    this.lastSaveData = data && typeof data === "object" ? { ...data } : {};
    const payload = {
      ...this.lastSaveData,
      personalRanking: snapshotPersonalRanking(),
    };
    const raw = JSON.stringify(payload);
    if (this.inYouTube) {
      this.pendingSave = {
        raw,
        bestScore: Math.max(0, Math.trunc(Number(payload?.bestScore) || 0)),
      };
      return this.flushSaves();
    }
    try {
      globalThis.localStorage?.setItem(LOCAL_SAVE_KEY, raw);
      return true;
    } catch {
      return false;
    }
  }

  async flushScore() {
    if (!this.inYouTube || this.paused) return true;
    if (this.scorePromise) return this.scorePromise;
    if (this.scoreTarget <= this.lastSentScore) return true;

    this.scorePromise = (async () => {
      while (!this.paused && this.scoreTarget > this.lastSentScore) {
        const target = this.scoreTarget;
        try {
          await globalThis.ytgame.engagement.sendScore({ value: target });
          this.lastSentScore = target;
        } catch (error) {
          console.warn("Unable to sync Playables score", error);
          return false;
        }
      }
      return true;
    })().finally(() => {
      this.scorePromise = null;
    });
    return this.scorePromise;
  }

  async sendScore(value) {
    if (!this.inYouTube) return true;
    const requested = Math.max(0, Math.trunc(Number(value) || 0));
    if (requested > this.savedBestScore) return false;
    this.scoreTarget = Math.max(this.scoreTarget, this.savedBestScore);
    return this.flushScore();
  }

  installSystemHandlers({ onPause, onResume }) {
    if (!this.inYouTube) return;

    try { setPlatformAudioEnabled(globalThis.ytgame.system.isAudioEnabled()); }
    catch { setPlatformAudioEnabled(true); }
    this.paused = false;
    setPlatformPaused(false);

    globalThis.ytgame.system.onAudioEnabledChange((enabled) => {
      setPlatformAudioEnabled(enabled);
    });
    globalThis.ytgame.system.onPause(() => {
      this.paused = true;
      setPlatformPaused(true);
      onPause();
    });
    globalThis.ytgame.system.onResume(() => {
      this.paused = false;
      setPlatformPaused(false);
      onResume();
      void this.flushSaves();
      void this.flushScore();
    });
  }
}
