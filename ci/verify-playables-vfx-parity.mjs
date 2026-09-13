import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const [sourceRootArg, artifactRootArg] = process.argv.slice(2);
assert.ok(sourceRootArg && artifactRootArg, "usage: node verify-playables-vfx-parity.mjs <web-root> <playables-root>");

const sourceRoot = path.resolve(sourceRootArg);
const artifactRoot = path.resolve(artifactRootArg);

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function walkFiles(root, relative = "") {
  const dir = path.join(root, relative);
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(root, child));
    else if (entry.isFile()) files.push(child.replaceAll(path.sep, "/"));
  }
  return files;
}

const requiredCore = [
  "index.html",
  "styles.css",
  "fever-hud.css",
  "src/orientation.js",
  "src/renderer.js",
  "src/vfx_contract.js",
  "src/vfx_phase0.js",
  "src/vfx_phase1.js",
  "src/vfx_phase2.js",
  "src/vfx_phase2_profiles.js",
  "src/vfx_phase3.js",
  "src/vfx_phase3_profiles.js",
  "src/vfx_phase4.js",
  "src/vfx_phase4_profiles.js",
];

const spriteFiles = walkFiles(sourceRoot, "assets/sprites");
assert.ok(spriteFiles.length > 0, "web source must contain VFX sprite assets");

const checked = [...requiredCore, ...spriteFiles];
for (const relative of checked) {
  const source = path.join(sourceRoot, relative);
  const artifact = path.join(artifactRoot, relative);
  assert.ok(fs.existsSync(source), `missing web VFX source: ${relative}`);
  assert.ok(fs.existsSync(artifact), `missing Playables VFX file: ${relative}`);
  assert.equal(
    sha256(artifact),
    sha256(source),
    `Web/Playables VFX parity mismatch: ${relative}`,
  );
}

const playablesBootstrap = fs.readFileSync(path.join(artifactRoot, "src/bootstrap.js"), "utf8");
for (let phase = 0; phase <= 4; phase += 1) {
  assert.ok(
    playablesBootstrap.includes(`./vfx_phase${phase}.js`),
    `Playables bootstrap must load VFX phase ${phase}`,
  );
}

console.log(`Playables VFX parity passed: ${checked.length} files match Web source`);
