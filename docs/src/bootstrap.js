import "./audio.js";
import "./bgm.js?v=audio-controls-2";

const inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);

async function start() {
  if (!inYouTube) {
    await import("./ranking_transport.js?v=ranking-save-2");
  }
  await import("./main.js?v=youtube-score-sync-1");
}

start().catch((error) => {
  console.error(error);
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = "Unable to start 2048TD";
});
