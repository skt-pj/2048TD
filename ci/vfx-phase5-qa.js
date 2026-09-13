const phase2 = await import("/module/vfx_phase2_profiles.js");
const phase3 = await import("/module/vfx_phase3_profiles.js");
const phase4 = await import("/module/vfx_phase4_profiles.js");

const canvas = document.getElementById("qa-canvas");
const ctx = canvas.getContext("2d", { alpha: false });
const CARD_W = 278;
const CARD_H = 164;
const LABEL_H = 24;
const GAP_X = 12;
const GAP_Y = 16;
const START_X = 12;
const START_Y = 12;
const COLS = 4;

ctx.fillStyle = "#060a0f";
ctx.fillRect(0, 0, canvas.width, canvas.height);

const results = [];

function activePixelCount(effectCanvas) {
  const data = effectCanvas.getContext("2d").getImageData(0, 0, effectCanvas.width, effectCanvas.height).data;
  let count = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 4) count += 1;
  }
  return count;
}

function renderCard(index, label, draw) {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = START_X + col * (CARD_W + GAP_X);
  const y = START_Y + row * (CARD_H + LABEL_H + GAP_Y);

  const effect = document.createElement("canvas");
  effect.width = CARD_W;
  effect.height = CARD_H;
  const effectCtx = effect.getContext("2d");
  effectCtx.clearRect(0, 0, CARD_W, CARD_H);
  draw(effectCtx, CARD_W, CARD_H);
  const pixels = activePixelCount(effect);
  if (pixels < 20) throw new Error(`${label} rendered too few pixels: ${pixels}`);

  ctx.fillStyle = "#05090d";
  ctx.fillRect(x, y, CARD_W, CARD_H);
  ctx.strokeStyle = "rgba(0,245,255,.32)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, CARD_W - 1, CARD_H - 1);
  ctx.drawImage(effect, x, y);
  ctx.fillStyle = "#a4b7c2";
  ctx.font = "700 11px system-ui";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`${label} · ${pixels}px`, x + 8, y + CARD_H + LABEL_H / 2);
  results.push({ label, pixels });
}

renderCard(0, "NORMAL HIT", (c) => {
  const point = { x: CARD_W * 0.56, y: CARD_H * 0.46 };
  const previous = { x: CARD_W * 0.56, y: CARD_H * 0.61 };
  const source = { x: CARD_W * 0.56, y: CARD_H * 0.92 };
  phase2.drawPhase2ProjectileTrail(c, { weaponType: "NORMAL" }, point, previous, source, false);
  phase2.drawPhase2Impact(
    c,
    { type: "HIT", weaponType: "NORMAL", particleBudget: 6 },
    point,
    source,
    85,
  );
});

renderCard(1, "EXPLOSIVE KILL", (c) => {
  phase2.drawPhase2Impact(
    c,
    { type: "KILL", weaponType: "EXPLOSIVE", particleBudget: 8 },
    { x: CARD_W * 0.52, y: CARD_H * 0.50 },
    { x: CARD_W * 0.52, y: CARD_H * 0.94 },
    115,
  );
});

renderCard(2, "LASER TRAIL", (c) => {
  phase2.drawPhase2ProjectileTrail(
    c,
    { weaponType: "LASER" },
    { x: CARD_W * 0.68, y: CARD_H * 0.36 },
    { x: CARD_W * 0.62, y: CARD_H * 0.46 },
    { x: CARD_W * 0.50, y: CARD_H * 0.95 },
    true,
  );
  phase2.drawPhase2Impact(
    c,
    { type: "HIT", weaponType: "LASER", particleBudget: 6 },
    { x: CARD_W * 0.68, y: CARD_H * 0.36 },
    { x: CARD_W * 0.50, y: CARD_H * 0.95 },
    90,
  );
});

renderCard(3, "PIERCING", (c) => {
  phase2.drawPhase2ProjectileTrail(
    c,
    { weaponType: "PIERCING" },
    { x: CARD_W * 0.66, y: CARD_H * 0.38 },
    { x: CARD_W * 0.58, y: CARD_H * 0.49 },
    { x: CARD_W * 0.50, y: CARD_H * 0.94 },
    false,
  );
  phase2.drawPhase2Impact(
    c,
    { type: "HIT", weaponType: "PIERCING", particleBudget: 5 },
    { x: CARD_W * 0.66, y: CARD_H * 0.38 },
    { x: CARD_W * 0.50, y: CARD_H * 0.94 },
    95,
  );
});

renderCard(4, "BOSS WARNING", (c) => {
  phase3.drawPhase3BossWarning(c, { x: CARD_W / 2, y: CARD_H / 2 }, 0.48);
});

renderCard(5, "BOSS SPAWN", (c) => {
  phase3.drawPhase3BossSpawn(
    c,
    { id: 31, type: "BOSS_SPAWN", particleBudget: 14 },
    { x: CARD_W / 2, y: CARD_H / 2 },
    180,
    CARD_W,
    CARD_H,
  );
});

renderCard(6, "BOSS HIT / ATTACK", (c) => {
  const point = { x: CARD_W * 0.50, y: CARD_H * 0.45 };
  phase3.drawPhase3BossAttack(
    c,
    { id: 9, enemyType: "BOSS", progress: 0.88 },
    point,
    { x: CARD_W * 0.50, y: CARD_H * 0.94 },
    2350,
  );
  phase3.drawPhase3BossHit(
    c,
    { id: 41, type: "HIT", targetType: "BOSS", particleBudget: 9 },
    point,
    125,
  );
});

renderCard(7, "BOSS DEATH", (c) => {
  phase3.drawPhase3BossDeath(
    c,
    { id: 57, type: "BOSS_KILL", targetType: "BOSS", particleBudget: 18 },
    { x: CARD_W / 2, y: CARD_H / 2 },
    180,
    CARD_W,
    CARD_H,
  );
});

renderCard(8, "MERGE / COMBO", (c) => {
  const target = { x: CARD_W * 0.78, y: CARD_H * 0.20 };
  const sources = [
    { x: CARD_W * 0.28, y: CARD_H * 0.70 },
    { x: CARD_W * 0.52, y: CARD_H * 0.76 },
  ];
  phase4.drawPhase4Merge(c, sources[0], 128, 150);
  phase4.drawPhase4Merge(c, sources[1], 256, 180);
  phase4.drawPhase4ComboStream(c, sources, target, 250);
});

renderCard(9, "FEVER START · PORTRAIT", (c) => {
  phase4.drawPhase4FeverStart(
    c,
    { x: 18, y: 12, width: CARD_W - 36, height: CARD_H - 24 },
    180,
    false,
    false,
  );
});

renderCard(10, "FEVER ACTIVE · LANDSCAPE", (c) => {
  phase4.drawPhase4FeverActive(
    c,
    { x: 16, y: 16, width: CARD_W - 32, height: CARD_H - 32 },
    2_500,
    3.0,
    true,
    false,
  );
});

renderCard(11, "128+ / WEAPON EVOLUTION", (c) => {
  phase4.drawPhase4Milestone(
    c,
    [{ x: CARD_W * 0.34, y: CARD_H * 0.55 }],
    [{ x: CARD_W * 0.70, y: CARD_H * 0.55 }],
    210,
  );
});

const minimumPixels = Math.min(...results.map((result) => result.pixels));
document.body.dataset.vfxQa = "pass";
document.body.dataset.caseCount = String(results.length);
document.body.dataset.minPixels = String(minimumPixels);
