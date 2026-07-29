#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "..");
const CANVAS = { width: 1024, height: 1280 };
const ALPHA_THRESHOLD = 12;
const DEFAULT_CONCURRENCY = Math.max(2, Math.min(6, os.cpus().length - 1));
const CATEGORY_FITS = {
  Outerwear: { maxWidth: 820, maxHeight: 1040, anchorX: 0.5, anchorY: 0.5 },
  Tops: { maxWidth: 820, maxHeight: 960, anchorX: 0.5, anchorY: 0.48 },
  Tailoring: { maxWidth: 820, maxHeight: 1040, anchorX: 0.5, anchorY: 0.5 },
  Bottoms: { maxWidth: 780, maxHeight: 1080, anchorX: 0.5, anchorY: 0.52 },
  Footwear: { maxWidth: 896, maxHeight: 800, anchorX: 0.5, anchorY: 0.5 },
  Accessories: { maxWidth: 820, maxHeight: 820, anchorX: 0.5, anchorY: 0.5 },
};

function parseArguments(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (!argument.startsWith("--")) continue;
    const equals = argument.indexOf("=");
    if (equals > 0) {
      options[argument.slice(2, equals)] = argument.slice(equals + 1);
      continue;
    }
    const name = argument.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      options[name] = next;
      index += 1;
    } else {
      options[name] = true;
    }
  }
  return { command, options };
}

function printHelp() {
  process.stdout.write(`
Formé fast garment batch

Uso:
  npm run garments:prepare -- --manifest <archivo.json>
  npm run garments:release -- --manifest <archivo.json> [--deploy]

prepare
  Solo acepta retail API aprobado después de generación. Consume el calado del
  proveedor configurado, normaliza en paralelo, ejecuta QA técnico y crea dos
  contact sheets. Los lotes legacy pueden usar el extractor local.

release
  Continúa sin otra espera humana cuando prepare pasa. Hace backup, integra,
  ejecuta npm test, publica una vez con --deploy y verifica los assets live.
`);
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function resolvePath(value) {
  if (!value || typeof value !== "string") throw new Error("Missing path");
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(REPO_ROOT, value);
}

function relativeToRepo(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

function assertInsideRepo(filePath, label) {
  const relative = path.relative(REPO_ROOT, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must live inside the repository: ${filePath}`);
  }
}

function loadManifest(manifestArgument) {
  if (!manifestArgument) throw new Error("Missing --manifest");
  const manifestPath = resolvePath(manifestArgument);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!manifest.batchId || !Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error("Manifest requires batchId and a non-empty items array");
  }
  const ids = new Set();
  for (const item of manifest.items) {
    if (!/^\d{3}(?:\d{3})?$/.test(item.id ?? "")) {
      throw new Error(`Invalid item id ${item.id}; use 000 or 000000`);
    }
    if (ids.has(item.id)) throw new Error(`Duplicate item id ${item.id}`);
    ids.add(item.id);
    if (item.generationApproved !== true) {
      throw new Error(
        `${item.id} has no post-generation approval; cutout is forbidden`,
      );
    }
    const inputPath = resolvePath(item.input);
    if (!fs.existsSync(inputPath)) throw new Error(`${item.id} input does not exist`);
    if (item.cutout) {
      const cutoutPath = resolvePath(item.cutout);
      if (!fs.existsSync(cutoutPath)) {
        throw new Error(`${item.id} API cutout does not exist`);
      }
    }
    if (item.id.length === 6) {
      const generation = item.generation;
      if (
        generation?.channel !== "api" ||
        !generation.provider ||
        !generation.model ||
        !generation.requestId
      ) {
        throw new Error(`${item.id} requires API generation provenance`);
      }
      if (!item.cutout) {
        throw new Error(`${item.id} requires the post-approval API cutout`);
      }
      if (
        generation.outputSha256 &&
        generation.outputSha256 !== sha256(inputPath)
      ) {
        throw new Error(`${item.id} approved output hash does not match input`);
      }
      if (item.source && generation.sourceSha256) {
        const sourcePath = resolvePath(item.source);
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`${item.id} source does not exist`);
        }
        if (generation.sourceSha256 !== sha256(sourcePath)) {
          throw new Error(`${item.id} source hash does not match provenance`);
        }
      }
    }
    if (!CATEGORY_FITS[item.category ?? manifest.category]) {
      throw new Error(`${item.id} has an unsupported category`);
    }
  }
  const outputRoot = resolvePath(
    manifest.outputRoot ?? `tmp/garment-pipeline/${manifest.batchId}/fast`,
  );
  assertInsideRepo(outputRoot, "outputRoot");
  return { manifest, manifestPath, outputRoot };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} failed: ${(result.stderr || result.stdout || "").trim()}`,
    );
  }
  return result.stdout ?? "";
}

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? REPO_ROOT,
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} failed: ${(stderr || stdout).trim()}`));
    });
  });
}

async function mapPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= items.length) return;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

function extractorPaths(outputRoot) {
  return {
    source: path.join(REPO_ROOT, "scripts/garment-pipeline/extract-foreground.swift"),
    binary: path.join(outputRoot, "bin/extract-foreground"),
  };
}

function ensureExtractor(outputRoot) {
  if (process.platform !== "darwin") {
    throw new Error("The fast cutout extractor currently requires macOS 15+");
  }
  const { source, binary } = extractorPaths(outputRoot);
  fs.mkdirSync(path.dirname(binary), { recursive: true });
  const moduleCache = path.join(outputRoot, "cache/swift-modules");
  fs.mkdirSync(moduleCache, { recursive: true });
  const needsCompile =
    !fs.existsSync(binary) ||
    fs.statSync(source).mtimeMs > fs.statSync(binary).mtimeMs;
  if (needsCompile) {
    run("swiftc", [
      "-parse-as-library",
      "-module-cache-path",
      moduleCache,
      "-target",
      "arm64-apple-macosx15.0",
      "-O",
      source,
      "-o",
      binary,
    ]);
  }
  return binary;
}

function alphaMetrics(data, info) {
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  let visible = 0;
  let partial = 0;
  let borderAlphaPixels = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * info.channels;
      const alpha = data[offset + 3];
      if (alpha > 0 && alpha < 255) partial += 1;
      if (
        alpha > ALPHA_THRESHOLD &&
        (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
      ) {
        borderAlphaPixels += 1;
      }
      if (alpha <= ALPHA_THRESHOLD) continue;
      visible += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) throw new Error("No foreground remains after refinement");
  const bbox = {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
  return {
    bbox,
    visiblePixels: visible,
    partialAlphaPixels: partial,
    coverage: Number((visible / (info.width * info.height)).toFixed(6)),
    borderAlphaPixels,
    margins: {
      left: bbox.x,
      top: bbox.y,
      right: info.width - bbox.x - bbox.width,
      bottom: info.height - bbox.y - bbox.height,
    },
  };
}

async function removeWhiteMatte(filePath) {
  const decoded = await sharp(filePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < decoded.data.length; offset += 4) {
    const alphaByte = decoded.data[offset + 3];
    if (alphaByte <= 4) {
      decoded.data.fill(0, offset, offset + 4);
      continue;
    }
    if (alphaByte >= 255) continue;
    const alpha = alphaByte / 255;
    for (let channel = 0; channel < 3; channel += 1) {
      const observed = decoded.data[offset + channel];
      decoded.data[offset + channel] = Math.max(
        0,
        Math.min(255, Math.round((observed - (1 - alpha) * 255) / alpha)),
      );
    }
  }
  const temporaryPath = `${filePath}.clean.png`;
  await sharp(decoded.data, {
    raw: {
      width: decoded.info.width,
      height: decoded.info.height,
      channels: 4,
    },
  })
    .png()
    .toFile(temporaryPath);
  fs.renameSync(temporaryPath, filePath);
}

async function processItem({ item, manifest, outputRoot, extractor }) {
  const category = item.category ?? manifest.category;
  const fit = { ...CATEGORY_FITS[category], ...(item.fit ?? {}) };
  const inputPath = resolvePath(item.input);
  const intermediateRoot = path.join(outputRoot, "intermediate");
  const normalizedRoot = path.join(outputRoot, "normalized");
  const receiptsRoot = path.join(outputRoot, "receipts");
  for (const directory of [intermediateRoot, normalizedRoot, receiptsRoot]) {
    fs.mkdirSync(directory, { recursive: true });
  }

  const visionPath = path.join(intermediateRoot, `${item.id}-vision.png`);
  const refinedPath = path.join(intermediateRoot, `${item.id}-refined.png`);
  const outputPath = path.join(normalizedRoot, `${item.id}.webp`);
  const receiptPath = path.join(receiptsRoot, `${item.id}.json`);
  let extraction;
  if (item.cutout) {
    const cutoutPath = resolvePath(item.cutout);
    await sharp(cutoutPath).ensureAlpha().png().toFile(visionPath);
    extraction = {
      method: "api-background-removal",
      provider: item.cutoutProvider ?? manifest.cutoutProvider ?? "configured-api",
      input: relativeToRepo(cutoutPath),
      inputSha256: sha256(cutoutPath),
    };
  } else {
    const visionOutput = run(extractor, [inputPath, visionPath]);
    extraction = JSON.parse(visionOutput);
  }

  const erosionRadius = Number(
    item.erosionRadius ?? (item.cutout ? 0 : 4),
  );
  if (erosionRadius > 0) {
    run("magick", [
      visionPath,
      "(",
      "+clone",
      "-alpha",
      "extract",
      "-morphology",
      "Erode",
      `Disk:${erosionRadius}`,
      "-blur",
      "0x0.65",
      ")",
      "-alpha",
      "off",
      "-compose",
      "CopyOpacity",
      "-composite",
      refinedPath,
    ]);
  } else {
    fs.copyFileSync(visionPath, refinedPath);
  }
  if (item.removeWhiteMatte ?? !item.cutout) {
    await removeWhiteMatte(refinedPath);
  }

  const refined = await sharp(refinedPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const sourceAlpha = alphaMetrics(refined.data, refined.info);
  if (sourceAlpha.borderAlphaPixels !== 0) {
    throw new Error("Refined foreground touches the input canvas");
  }

  const scale = Math.min(
    fit.maxWidth / sourceAlpha.bbox.width,
    fit.maxHeight / sourceAlpha.bbox.height,
  );
  const targetWidth = Math.max(1, Math.round(sourceAlpha.bbox.width * scale));
  const targetHeight = Math.max(1, Math.round(sourceAlpha.bbox.height * scale));
  const left = Math.max(
    0,
    Math.min(
      CANVAS.width - targetWidth,
      Math.round(CANVAS.width * fit.anchorX - targetWidth / 2),
    ),
  );
  const top = Math.max(
    0,
    Math.min(
      CANVAS.height - targetHeight,
      Math.round(CANVAS.height * fit.anchorY - targetHeight / 2),
    ),
  );
  const subject = await sharp(refinedPath)
    .extract({
      left: sourceAlpha.bbox.x,
      top: sourceAlpha.bbox.y,
      width: sourceAlpha.bbox.width,
      height: sourceAlpha.bbox.height,
    })
    .resize(targetWidth, targetHeight, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS.width,
      height: CANVAS.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: subject, left, top }])
    .webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 6 })
    .toFile(outputPath);

  const final = await sharp(outputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const metadata = await sharp(outputPath).metadata();
  const finalAlpha = alphaMetrics(final.data, final.info);
  if (
    metadata.width !== CANVAS.width ||
    metadata.height !== CANVAS.height ||
    !metadata.hasAlpha ||
    finalAlpha.borderAlphaPixels !== 0
  ) {
    throw new Error("Normalized output violates size, alpha, or safe area");
  }

  const receipt = {
    id: item.id,
    status: "PASS",
    category,
    input: relativeToRepo(inputPath),
    inputSha256: sha256(inputPath),
    output: relativeToRepo(outputPath),
    outputSha256: sha256(outputPath),
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    alpha: finalAlpha,
    fittedSubject: { width: targetWidth, height: targetHeight, left, top },
    generation: item.generation ?? null,
    extraction,
  };
  writeJson(receiptPath, receipt);
  return receipt;
}

async function buildContactSheet({ manifest, outputRoot, background, fileName }) {
  const tileWidth = 640;
  const tileHeight = 390;
  const columns = 3;
  const tiles = await Promise.all(
    manifest.items.map(async (item) => {
      const input = await sharp(resolvePath(item.input))
        .resize(292, 320, {
          fit: "contain",
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();
      const output = await sharp(path.join(outputRoot, "normalized", `${item.id}.webp`))
        .resize(292, 320, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      const label = Buffer.from(`
        <svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
          <text x="16" y="26" fill="${background.r < 80 ? "#fff" : "#111"}"
                font-size="18" font-weight="700"
                font-family="Arial, Helvetica, sans-serif">${item.id}</text>
          <text x="16" y="50" fill="${background.r < 80 ? "#aaa" : "#555"}"
                font-size="12" font-family="Arial, Helvetica, sans-serif">APROBADA</text>
          <text x="332" y="50" fill="${background.r < 80 ? "#aaa" : "#555"}"
                font-size="12" font-family="Arial, Helvetica, sans-serif">CALADA</text>
        </svg>
      `);
      return sharp({
        create: { width: tileWidth, height: tileHeight, channels: 4, background },
      })
        .composite([
          { input, left: 16, top: 58 },
          { input: output, left: 332, top: 58 },
          { input: label, left: 0, top: 0 },
        ])
        .png()
        .toBuffer();
    }),
  );
  const rows = Math.ceil(tiles.length / columns);
  const sheetPath = path.join(outputRoot, fileName);
  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 4,
      background,
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      })),
    )
    .png()
    .toFile(sheetPath);
  return relativeToRepo(sheetPath);
}

async function prepare({ manifest, manifestPath, outputRoot, options }) {
  const concurrency = Math.max(
    1,
    Number(options.concurrency ?? manifest.concurrency ?? DEFAULT_CONCURRENCY),
  );
  fs.mkdirSync(outputRoot, { recursive: true });
  const startedAt = Date.now();
  const results = await mapPool(manifest.items, concurrency, async (item) => {
    try {
      const worker = await runAsync(process.execPath, [
        SCRIPT_PATH,
        "_process",
        "--manifest",
        manifestPath,
        "--id",
        item.id,
      ]);
      const receipt = JSON.parse(worker.stdout.trim().split("\n").at(-1));
      process.stdout.write(`${item.id}: PASS\n`);
      return receipt;
    } catch (error) {
      const failure = { id: item.id, status: "FAIL", error: String(error.message) };
      writeJson(path.join(outputRoot, "receipts", `${item.id}.json`), failure);
      process.stderr.write(`${item.id}: FAIL — ${failure.error}\n`);
      return failure;
    }
  });

  const passed = results.filter((item) => item.status === "PASS");
  const failed = results.filter((item) => item.status !== "PASS");
  const contactSheets =
    failed.length === 0
      ? [
          await buildContactSheet({
            manifest,
            outputRoot,
            background: { r: 217, g: 213, b: 204, alpha: 1 },
            fileName: "review-gray.png",
          }),
          await buildContactSheet({
            manifest,
            outputRoot,
            background: { r: 17, g: 17, b: 15, alpha: 1 },
            fileName: "review-black.png",
          }),
        ]
      : [];
  const summary = {
    batchId: manifest.batchId,
    status: failed.length === 0 ? "READY_FOR_RELEASE" : "BLOCKED",
    expected: manifest.items.length,
    passed: passed.length,
    failed: failed.length,
    concurrency,
    durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
    contactSheets,
    failures: failed,
  };
  writeJson(path.join(outputRoot, "prepare-summary.json"), summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failed.length) process.exitCode = 1;
}

async function processSingle({ manifest, outputRoot, options }) {
  const item = manifest.items.find((candidate) => candidate.id === options.id);
  if (!item) throw new Error(`Unknown --id ${options.id}`);
  const extractor = item.cutout ? null : ensureExtractor(outputRoot);
  const receipt = await processItem({ item, manifest, outputRoot, extractor });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function fetchLiveAssets({ manifest, version }) {
  const baseUrl = (manifest.baseUrl ?? "https://forme.gallery").replace(/\/$/, "");
  const results = await Promise.all(
    manifest.items.map(async (item) => {
      const destination = resolvePath(item.destination);
      const publicRelative = path.relative(path.join(REPO_ROOT, "public"), destination);
      const url = `${baseUrl}/${publicRelative.split(path.sep).join("/")}?release=${version}`;
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) throw new Error(`${item.id}: live HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const liveSha256 = crypto.createHash("sha256").update(bytes).digest("hex");
      const expectedSha256 = sha256(
        path.join(resolvePath(manifest.outputRoot ?? `tmp/garment-pipeline/${manifest.batchId}/fast`), "normalized", `${item.id}.webp`),
      );
      return {
        id: item.id,
        url,
        contentType: response.headers.get("content-type"),
        liveSha256,
        expectedSha256,
        match: liveSha256 === expectedSha256,
      };
    }),
  );
  return results;
}

async function release({ manifest, outputRoot, options }) {
  const prepareSummaryPath = path.join(outputRoot, "prepare-summary.json");
  if (!fs.existsSync(prepareSummaryPath)) throw new Error("Run prepare first");
  const prepareSummary = JSON.parse(fs.readFileSync(prepareSummaryPath, "utf8"));
  if (
    prepareSummary.status !== "READY_FOR_RELEASE" ||
    prepareSummary.passed !== manifest.items.length
  ) {
    throw new Error("The prepared batch is incomplete or blocked");
  }

  const backupRoot = path.join(outputRoot, "backup");
  fs.mkdirSync(backupRoot, { recursive: true });
  const integrated = [];
  for (const item of manifest.items) {
    if (!item.destination) throw new Error(`${item.id} is missing destination`);
    const source = path.join(outputRoot, "normalized", `${item.id}.webp`);
    const destination = resolvePath(item.destination);
    assertInsideRepo(destination, `${item.id} destination`);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const backup = path.join(backupRoot, path.basename(destination));
    if (fs.existsSync(destination) && !fs.existsSync(backup)) {
      fs.copyFileSync(destination, backup);
    }
    fs.copyFileSync(source, destination);
    integrated.push({
      id: item.id,
      destination: relativeToRepo(destination),
      sha256: sha256(destination),
      match: sha256(destination) === sha256(source),
    });
  }

  try {
    run("npm", ["test"], { inherit: true });
  } catch (error) {
    for (const item of manifest.items) {
      const destination = resolvePath(item.destination);
      const backup = path.join(backupRoot, path.basename(destination));
      if (fs.existsSync(backup)) fs.copyFileSync(backup, destination);
    }
    throw new Error(`Tests failed; public assets were restored. ${error.message}`);
  }

  let deployed = false;
  let live = [];
  const version = `${Date.now()}`;
  if (options.deploy === true) {
    run("npm", ["run", "deploy"], { inherit: true });
    deployed = true;
    live = await fetchLiveAssets({ manifest: { ...manifest, outputRoot }, version });
    if (live.some((item) => !item.match)) {
      throw new Error("Deploy completed but one or more live assets do not match");
    }
  }

  const summary = {
    batchId: manifest.batchId,
    status: deployed ? "LIVE_PASSED" : "INTEGRATED_TESTED",
    expected: manifest.items.length,
    integrated: integrated.length,
    integratedMatches: integrated.filter((item) => item.match).length,
    tests: "PASS",
    deployed,
    liveMatches: live.filter((item) => item.match).length,
    integratedItems: integrated,
    live,
  };
  writeJson(path.join(outputRoot, "release-summary.json"), summary);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const { command, options } = parseArguments(process.argv.slice(2));
if (command === "help" || options.help === true) {
  printHelp();
} else {
  const context = loadManifest(options.manifest);
  if (command === "prepare") await prepare({ ...context, options });
  else if (command === "_process") await processSingle({ ...context, options });
  else if (command === "release") await release({ ...context, options });
  else throw new Error(`Unknown command ${command}`);
}
