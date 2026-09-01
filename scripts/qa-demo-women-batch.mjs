import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [directoryArg] = process.argv.slice(2);
if (!directoryArg) throw new Error("Uso: node scripts/qa-demo-women-batch.mjs <carpeta>");
const directory = path.resolve(directoryArg);
const files = fs.readdirSync(directory).filter((name) => /^\d{7}\.png$/.test(name)).sort();
const failures = [];
const report = [];
if (files.length !== 50) failures.push(`count:${files.length}`);

for (const name of files) {
  const decoded = await sharp(path.join(directory, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  let visible = 0;
  let opaque = 0;
  let chromaResidual = 0;
  let edgeVisible = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * channels;
      const r = decoded.data[offset];
      const g = decoded.data[offset + 1];
      const b = decoded.data[offset + 2];
      const a = decoded.data[offset + 3];
      if (a > 3) visible += 1;
      if (a > 250) opaque += 1;
      if (a > 16 && (g - Math.max(r, b) > 90 || Math.min(r, b) - g > 90)) chromaResidual += 1;
      if (a > 3 && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) edgeVisible += 1;
    }
  }
  const issues = [];
  if (width !== 1024 || height !== 1280) issues.push(`size:${width}x${height}`);
  if (visible === 0) issues.push("empty");
  if (opaque / Math.max(1, visible) < 0.90) issues.push(`opaque:${(opaque / visible).toFixed(3)}`);
  if (chromaResidual > Math.max(500, visible * 0.001)) issues.push(`chroma:${chromaResidual}`);
  if (edgeVisible > 0) issues.push(`touches-edge:${edgeVisible}`);
  if (issues.length) failures.push(`${name}:${issues.join(",")}`);
  report.push({ name, width, height, visible, opaque, chromaResidual, edgeVisible, issues });
}

fs.writeFileSync(path.join(directory, "qa.json"), `${JSON.stringify({ passed: failures.length === 0, failures, files: report }, null, 2)}\n`);
console.log(JSON.stringify({ passed: failures.length === 0, count: files.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
