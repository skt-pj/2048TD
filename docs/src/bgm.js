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
    this.fadeFrame = 0;
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
    if (!this.unlocked || this.suspended) return;
    const audio = this.tracks[this.current];
    if (restart) audio.currentTime = 0;
    audio.volume = TRACKS[this.current].volume;
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
    if (!this.unlocked || this.suspended) return;
    this.crossfade(previous, mode);
  }

  async crossfade(fromName, toName) {
    cancelAnimationFrame(this.fadeFrame);
    const from = this.tracks[fromName];
    const to = this.tracks[toName];
    const fromStart = from.volume;
    const toTarget = TRACKS[toName].volume;

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
    if (gameOver.hidden) controller.resetToNormal();
    syncPlaybackState();
  }).observe(gameOver, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
}
