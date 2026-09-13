import "./vfx_phase0.js?v=vfx-phase0-1";
import "./audio.js?v=youtube-platform-1";
import "./vfx_phase1.js?v=vfx-phase1-2";
import "./vfx_phase2.js?v=vfx-phase2-1";
import "./vfx_phase3.js?v=vfx-phase3-1";
import "./vfx_phase4.js?v=vfx-phase4-1";
import "./bgm.js?v=youtube-platform-1";
import "./help.js?v=settings-help-1";
import "./board_style_setup.js?v=board-style-3";
import "./enemy_horde.js?v=turret-aim-aura-1";

const inYouTube = typeof globalThis.ytgame !== "undefined" && Boolean(globalThis.ytgame.IN_PLAYABLES_ENV);

async function start() {
  if (!inYouTube) {
    await import("./ranking_transport.js?v=ranking-save-2");
  }
  await import("./main.js?v=turret-aim-aura-1");
}

start().catch((error) => {
  console.error(error);
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = "Unable to start 2048TD";
});
