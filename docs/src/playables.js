import { setPlatformAudioEnabled, setPlatformPaused } from "./platform_state.js";

const LOCAL_SAVE_KEY = "2048td-playables-preview-save";

export class PlayablesBridge {
  constructor() {
    this.inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);
    this.loaded = false;
    this.pendingSave = null;
    this.savePromise = null;
    this.scoreTarget = 0;
    this.lastSentScore = 0;
    this.scorePromise = null;
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
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (this.inYouTube) {
        this.scoreTarget = Math.max(this.scoreTarget, Math.max(0, Math.trunc(Number(parsed?.bestScore) || 0)));
      }
      return parsed;
    } catch {
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
          this.scoreTarget = Math.max(this.scoreTarget, current.bestScore);
        } catch (error) {
          if (this.pendingSave === null) this.pendingSave = current;
          console.warn("Unable to save Playables data", error);
          success = false;
          break;
        }
      }
      if (success) await this.flushScore();
      return success;
    })().finally(() => {
      this.savePromise = null;
    });
    return this.savePromise;
  }

  async save(data) {
    if (!this.loaded) return false;
    const raw = JSON.stringify(data);
    if (this.inYouTube) {
      this.pendingSave = {
        raw,
        bestScore: Math.max(0, Math.trunc(Number(data?.bestScore) || 0)),
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
    if (!this.inYouTube) return true;
    if (this.scorePromise) return this.scorePromise;
    if (this.scoreTarget <= this.lastSentScore) return true;

    this.scorePromise = (async () => {
      while (this.scoreTarget > this.lastSentScore) {
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
    this.scoreTarget = Math.max(this.scoreTarget, Math.max(0, Math.trunc(Number(value) || 0)));
    return this.flushScore();
  }

  installSystemHandlers({ onPause, onResume }) {
    if (!this.inYouTube) return;

    try { setPlatformAudioEnabled(globalThis.ytgame.system.isAudioEnabled()); }
    catch { setPlatformAudioEnabled(true); }
    setPlatformPaused(false);

    globalThis.ytgame.system.onAudioEnabledChange((enabled) => {
      setPlatformAudioEnabled(enabled);
    });
    globalThis.ytgame.system.onPause(() => {
      setPlatformPaused(true);
      onPause();
    });
    globalThis.ytgame.system.onResume(() => {
      setPlatformPaused(false);
      onResume();
      void this.flushSaves();
      void this.flushScore();
    });
  }
}
