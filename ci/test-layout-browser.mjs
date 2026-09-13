import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CI_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(CI_DIR, "..");

const productionIndex = fs.readFileSync(path.join(ROOT_DIR, "docs", "index.html"), "utf8");
for (const stylesheet of ["styles.css", "fever-hud.css", "settings-audio.css", "ranking.css", "layout-ratio.css"]) {
  const escaped = stylesheet.replaceAll(".", "\\.");
  assert.match(
    productionIndex,
    new RegExp(`href=["']\\./${escaped}\\?v=[^"']+["']`),
    `${stylesheet} must be cache-busted in docs/index.html so deployed mobile clients do not retain stale layout CSS`,
  );
}

function findChrome() {
  const explicit = process.env.CHROME_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chromium/Chrome is required for layout QA");
}

function mimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

function safeFile(base, relative) {
  const target = path.resolve(base, relative.replace(/^\/+/, ""));
  const prefix = `${path.resolve(base)}${path.sep}`;
  if (target !== path.resolve(base) && !target.startsWith(prefix)) return null;
  return target;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  let filePath = null;
  if (url.pathname === "/" || url.pathname === "/fixture/layout-qa.html") {
    filePath = path.join(CI_DIR, "layout-qa.html");
  } else if (url.pathname.startsWith("/docs/")) {
    filePath = safeFile(path.join(ROOT_DIR, "docs"), url.pathname.slice("/docs/".length));
  }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }
  response.writeHead(200, { "content-type": mimeType(filePath), "cache-control": "no-store" });
  fs.createReadStream(filePath).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert.ok(address && typeof address === "object");
const chrome = findChrome();

async function runCase(width, height, hand) {
  const url = `http://127.0.0.1:${address.port}/fixture/layout-qa.html?hand=${hand}`;
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    `--window-size=${width},${height}`,
    "--virtual-time-budget=1200",
    "--dump-dom",
    url,
  ];
  const result = await new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`Chrome exited ${code}: ${stderr.slice(-3000)}`)));
  });
  assert.match(result.stdout, /data-layout-qa="pass"/, `layout QA failed for ${width}x${height} ${hand}: ${result.stdout.match(/<html[^>]*>/)?.[0] ?? "no html"}`);
}

try {
  await runCase(390, 844, "left");
  await runCase(844, 390, "left");
  await runCase(844, 390, "right");
  console.log("Layout browser QA passed: portrait 1:1, landscape 1:1, FEVER inside HUD, handedness preserved, production CSS cache-busted");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
