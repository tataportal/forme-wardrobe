import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const importRoot = path.join(repoRoot, "public", "wardrobe", "imports");
const cssPath = path.join(repoRoot, "app", "globals.css");
const standardPath = path.join(repoRoot, "config", "garment-standard.json");
const standard = JSON.parse(await readFile(standardPath, "utf8"));
const errors = [];

function parseWebP(buffer, label) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") {
    errors.push(`${label}: no es un WebP RIFF válido`);
    return;
  }

  let offset = 12;
  let width;
  let height;
  let alphaFlag = false;
  let alphaChunk = false;

  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;

    if (type === "VP8X" && size >= 10 && data + 10 <= buffer.length) {
      alphaFlag = Boolean(buffer[data] & 0x10);
      width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16);
      height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16);
    }
    if (type === "ALPH") alphaChunk = true;

    offset = data + size + (size % 2);
  }

  if (width !== standard.asset.width || height !== standard.asset.height) {
    errors.push(`${label}: ${width ?? "?"}×${height ?? "?"}; debe ser ${standard.asset.width}×${standard.asset.height}`);
  }
  if (!alphaFlag || !alphaChunk) {
    errors.push(`${label}: no tiene transparencia WebP verificable`);
  }
}

async function validateBatch(batchName) {
  const batchDir = path.join(importRoot, batchName);
  const entries = await readdir(batchDir, { withFileTypes: true });
  const assets = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"))
    .map((entry) => entry.name)
    .sort();

  if (assets.length === 0) errors.push(`${batchName}: el lote no contiene WebP finales`);

  for (const asset of assets) {
    if (!/^\d{3}_[A-Za-z0-9-]+\.webp$/.test(asset)) {
      errors.push(`${batchName}/${asset}: nombre fuera del patrón 001_FUENTE.webp`);
    }
    parseWebP(await readFile(path.join(batchDir, asset)), `${batchName}/${asset}`);
  }

  const manifestPath = path.join(repoRoot, "app", `imported-garments-${batchName}.ts`);
  let manifest;
  try {
    manifest = await readFile(manifestPath, "utf8");
  } catch {
    errors.push(`${batchName}: falta app/imported-garments-${batchName}.ts`);
    return;
  }

  const manifestAssets = [...manifest.matchAll(/file:\s*"([^"]+\.webp)"/g)]
    .map((match) => match[1])
    .sort();
  const missingFromManifest = assets.filter((asset) => !manifestAssets.includes(asset));
  const missingFromDisk = manifestAssets.filter((asset) => !assets.includes(asset));

  if (new Set(manifestAssets).size !== manifestAssets.length) {
    errors.push(`${batchName}: el manifest contiene archivos duplicados`);
  }
  if (missingFromManifest.length) {
    errors.push(`${batchName}: assets sin manifest: ${missingFromManifest.join(", ")}`);
  }
  if (missingFromDisk.length) {
    errors.push(`${batchName}: manifest apunta a archivos ausentes: ${missingFromDisk.join(", ")}`);
  }
}

const batches = (await readdir(importRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

for (const batch of batches) await validateBatch(batch);

const css = await readFile(cssPath, "utf8");
if (!css.includes(`${standard.presentation.rendererToken}:`)) {
  errors.push(`globals.css: falta ${standard.presentation.rendererToken}`);
}
if (!css.includes(standard.presentation.outline)) {
  errors.push(`globals.css: el sticker Formé debe usar ${standard.presentation.outline}`);
}
if (/--garment-(?:import|batch|lot)[\w-]*-sticker-filter/i.test(css)) {
  errors.push("globals.css: existe un filtro sticker específico por lote");
}
if (/img\s*\[\s*src\*?=.*wardrobe\/imports/i.test(css)) {
  errors.push("globals.css: existe un selector visual específico para imports");
}

if (errors.length) {
  console.error(`\nGarment standard: ${errors.length} error(es)\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Garment standard OK: ${batches.length} lote(s) técnico(s) validados.`);
