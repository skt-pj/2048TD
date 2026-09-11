const LOCAL_SAVE_KEY = "2048td-playables-preview-save";

export class PlayablesBridge {
  constructor() {
    this.inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);
    this.loaded = false;
  }

  firstFrameReady() {
    if (this.inYouTube) globalThis.ytgame.game.firstFrameReady();
  }

  gameReady() {
    if (this.inYouTube) globalThis.ytgame.game.gameReady();
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
    try { return JSON.parse(raw); } catch { return null; }
  }

  async save(data) {
    if (!this.loaded) return;
    const raw = JSON.stringify(data);
    if (this.inYouTube) {
      try { await globalThis.ytgame.game.saveData(raw); } catch { /* best effort */ }
    } else {
      try { globalThis.localStorage?.setItem(LOCAL_SAVE_KEY, raw); } catch { /* preview only */ }
    }
  }

  async sendScore(value) {
    if (!this.inYouTube) return;
    try { await globalThis.ytgame.engagement.sendScore({ value: Math.max(0, Math.trunc(value)) }); } catch { /* best effort */ }
  }

  installSystemHandlers({ onPause, onResume }) {
    if (!this.inYouTube) return;
    globalThis.ytgame.system.onPause(onPause);
    globalThis.ytgame.system.onResume(onResume);
    globalThis.ytgame.system.onAudioEnabledChange(() => {});
  }
}
