import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CI_DIR = path.dirname(fileURLToPath(import.meta.url));
const [moduleDirArg, screenshotArg] = process.argv.slice(2);
assert.ok(moduleDirArg && screenshotArg, "usage: node test-vfx-phase5-browser.mjs <module-dir> <screenshot.png>");

const moduleDir = path.resolve(moduleDirArg);
const screenshotPath = path.resolve(screenshotArg);
assert.ok(fs.existsSync(moduleDir), `module directory not found: ${moduleDir}`);
fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

function findChrome() {
  const explicit = process.env.CHROME_BIN;
  if (explicit && fs.existsSync(explicit)) return explicit;
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chromium/Chrome is required for P5 visual QA");
}

function mimeType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".png")) return "image/png";
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
  if (url.pathname === "/" || url.pathname === "/fixture/vfx-phase5-qa.html") {
    filePath = path.join(CI_DIR, "vfx-phase5-qa.html");
  } else if (url.pathname === "/fixture/vfx-phase5-qa.js") {
    filePath = path.join(CI_DIR, "vfx-phase5-qa.js");
  } else if (url.pathname.startsWith("/module/")) {
    filePath = safeFile(moduleDir, url.pathname.slice("/module/".length));
  }

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeType(filePath),
    "cache-control": "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

const address = server.address();
assert.ok(address && typeof address === "object");
const url = `http://127.0.0.1:${address.port}/fixture/vfx-phase5-qa.html`;
const chrome = findChrome();

function runChrome(extraArgs) {
  const args = [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    "--window-size=1280,900",
    "--virtual-time-budget=1800",
    ...extraArgs,
    url,
  ];
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Chrome exited ${code}: ${stderr.slice(-4000)}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

try {
  const dom = await runChrome(["--dump-dom"]);
  assert.match(dom.stdout, /data-vfx-qa="pass"/, "VFX QA fixture did not complete successfully");
  assert.match(dom.stdout, /data-case-count="12"/, "all 12 VFX acceptance cases must render");

  if (fs.existsSync(screenshotPath)) fs.unlinkSync(screenshotPath);
  await runChrome([`--screenshot=${screenshotPath}`]);
  assert.ok(fs.existsSync(screenshotPath), "Chrome did not create the QA screenshot");
  const png = fs.readFileSync(screenshotPath);
  assert.ok(png.length > 20_000, `QA screenshot is unexpectedly small: ${png.length} bytes`);
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", "QA capture must be PNG");
  assert.equal(png.readUInt32BE(16), 1280, "QA screenshot width mismatch");
  assert.equal(png.readUInt32BE(20), 900, "QA screenshot height mismatch");
  console.log(`VFX phase 5 browser QA passed: ${screenshotPath} (${png.length} bytes)`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
