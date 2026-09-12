const TRACKS = Object.freeze({
  normal: {
    src: new URL("../assets/audio/default.mp3", import.meta.url).href,
    volume: 0.50,
  },
  fever: {
    src: new URL("../assets/audio/fiver.mp3", import.meta.url).href,
    volume: 0.60,
  },
});

const CROSSFADE_MS = 260;

function createTrack({ src }) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.playsInline = true;
  audio.volume = 0;
  return audio;
}

class BgmController {
  constructor() {
    this.tracks = {
      normal: createTrack(TRACKS.normal),
      fever: createTrack(TRACKS.fever),
    };
    this.current = "normal";
    this.unlocked = false;
    this.suspended = false;
    this.enabled = true;
    this.masterVolume = 1;
    this.fadeFrame = 0;
  }

  targetVolume(name) {
    return this.enabled ? TRACKS[name].volume * this.masterVolume : 0;
  }

  setPreferences(preferences) {
    const wasEnabled = this.enabled;
    this.enabled = preferences?.bgmEnabled !== false;
    const numericVolume = Number(preferences?.bgmVolume);
    this.masterVolume = Number.isFinite(numericVolume)
      ? Math.max(0, Math.min(1, numericVolume))
      : 1;

    cancelAnimationFrame(this.fadeFrame);

    if (!this.enabled) {
      for (const audio of Object.values(this.tracks)) {
        audio.pause();
        audio.volume = 0;
      }
      return;
    }

    for (const [name, audio] of Object.entries(this.tracks)) {
      audio.volume = name === this.current && !audio.paused ? this.targetVolume(name) : 0;
    }

    if (!wasEnabled && this.unlocked && !this.suspended) {
      this.playCurrent(false);
      return;
    }

    const current = this.tracks[this.current];
    if (!current.paused) current.volume = this.targetVolume(this.current);
  }

  preload() {
    this.tracks.normal.load();
    this.tracks.fever.load();
  }

  async unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    await this.playCurrent(true);
  }

  async playCurrent(restart = false) {
    if (!this.unlocked || this.suspended || !this.enabled) return;
    const audio = this.tracks[this.current];
    if (restart) audio.currentTime = 0;
    audio.volume = this.targetVolume(this.current);
    try {
      await audio.play();
    } catch (error) {
      this.unlocked = false;
      console.warn("BGM playback was blocked until the next user input.", error);
    }
  }

  setMode(mode) {
    if (!(mode in this.tracks) || mode === this.current) return;
    const previous = this.current;
    this.current = mode;
    if (!this.unlocked || this.suspended || !this.enabled) return;
    this.crossfade(previous, mode);
  }

  async crossfade(fromName, toName) {
    cancelAnimationFrame(this.fadeFrame);
    const from = this.tracks[fromName];
    const to = this.tracks[toName];
    const fromStart = from.volume;
    const toTarget = this.targetVolume(toName);

    to.currentTime = 0;
    to.volume = 0;
    try {
      await to.play();
    } catch (error) {
      this.unlocked = false;
      console.warn("BGM transition was blocked until the next user input.", error);
      return;
    }

    const startedAt = performance.now();
    const step = (now) => {
      if (!this.enabled || this.suspended) {
        from.pause();
        to.pause();
        from.volume = 0;
        to.volume = 0;
        return;
      }
      const ratio = Math.min(1, (now - startedAt) / CROSSFADE_MS);
      from.volume = fromStart * (1 - ratio);
      to.volume = toTarget * ratio;
      if (ratio < 1) {
        this.fadeFrame = requestAnimationFrame(step);
        return;
      }
      from.pause();
      from.currentTime = 0;
      from.volume = 0;
    };
    this.fadeFrame = requestAnimationFrame(step);
  }

  suspend() {
    if (this.suspended) return;
    this.suspended = true;
    cancelAnimationFrame(this.fadeFrame);
    this.tracks.normal.pause();
    this.tracks.fever.pause();
  }

  resume() {
    if (!this.suspended) return;
    this.suspended = false;
    this.playCurrent(false);
  }

  resetToNormal() {
    cancelAnimationFrame(this.fadeFrame);
    this.current = "normal";
    for (const audio of Object.values(this.tracks)) {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0;
    }
    this.playCurrent(true);
  }
}

const controller = new BgmController();
const app = document.getElementById("app");
const settings = document.getElementById("settings-overlay");
const gameOver = document.getElementById("game-over");
let gameOverWasVisible = gameOver ? !gameOver.hidden : false;

export function setBgmPreferences(preferences) {
  controller.setPreferences(preferences);
}

function gameShouldPause() {
  return document.hidden || !settings?.hidden || !gameOver?.hidden;
}

function syncPlaybackState() {
  if (gameShouldPause()) controller.suspend();
  else controller.resume();
}

function syncFeverMode() {
  controller.setMode(app?.classList.contains("fever-active") ? "fever" : "normal");
}

controller.preload();

const unlock = () => controller.unlock();
document.addEventListener("pointerdown", unlock, { passive: true });
document.addEventListener("keydown", unlock);
document.addEventListener("visibilitychange", syncPlaybackState);

if (app) {
  new MutationObserver(syncFeverMode).observe(app, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

if (settings) {
  new MutationObserver(syncPlaybackState).observe(settings, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
}

if (gameOver) {
  new MutationObserver(() => {
    const visible = !gameOver.hidden;
    if (gameOverWasVisible && !visible) controller.resetToNormal();
    gameOverWasVisible = visible;
    syncPlaybackState();
  }).observe(gameOver, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
}
