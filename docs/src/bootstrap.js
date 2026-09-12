import "./audio.js?v=youtube-platform-1";
import "./bgm.js?v=youtube-platform-1";
import "./help.js?v=settings-help-1";

const inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);

async function start() {
  if (!inYouTube) {
    await import("./ranking_transport.js?v=ranking-save-2");
  }
  await import("./main.js?v=youtube-platform-2");
}

start().catch((error) => {
  console.error(error);
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = "Unable to start 2048TD";
});
