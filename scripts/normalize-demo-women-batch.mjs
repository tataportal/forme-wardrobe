import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error("Uso: node scripts/normalize-demo-women-batch.mjs <cutouts> <salida>");
}

const inputDirectory = path.resolve(inputArg);
const outputDirectory = path.resolve(outputArg);
const canvas = { width: 1024, height: 1280 };
const startCode = 171;
const rules = {
  outerwear: { width: 0.78, height: 0.84, y: 0.50 },
  top: { width: 0.68, height: 0.68, y: 0.48 },
  bottom: { width: 0.64, height: 0.80, y: 0.51 },
  shoes: { width: 0.66, height: 0.43, y: 0.57 },
  accessory: { width: 0.56, height: 0.38, y: 0.50 },
};

function categoryFrom(name) {
  const category = name.split("-")[1];
  if (!rules[category]) throw new Error(`Categoría desconocida en ${name}`);
  return category;
}

function alphaBounds({ data, info }) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  const alpha = info.channels - 1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + alpha] <= 3) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error("Imagen sin píxeles visibles.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

const files = fs.readdirSync(inputDirectory).filter((name) => name.endsWith(".png")).sort();
if (files.length !== 50) throw new Error(`Se esperaban 50 imágenes y hay ${files.length}.`);
fs.mkdirSync(outputDirectory, { recursive: true });

const report = [];
for (let index = 0; index < files.length; index += 1) {
  const sourceName = files[index];
  const source = path.join(inputDirectory, sourceName);
  const category = categoryFrom(sourceName);
  const rule = rules[category];
  const raw = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bounds = alphaBounds(raw);
  const scale = Math.min(
    (canvas.width * rule.width) / bounds.width,
    (canvas.height * rule.height) / bounds.height,
  );
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const left = Math.round((canvas.width - width) / 2);
  const top = Math.round(canvas.height * rule.y - height / 2);
  const layer = await sharp(source)
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const code = String(startCode + index).padStart(7, "0");
  const output = path.join(outputDirectory, `${code}.png`);
  await sharp({
    create: { width: canvas.width, height: canvas.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: layer, left, top }]).png({ compressionLevel: 9 }).toFile(output);
  report.push({ code, source: sourceName, category, sourceBounds: bounds, outputBounds: { left, top, width, height } });
}

fs.writeFileSync(path.join(outputDirectory, "normalization.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ count: report.length, first: report[0].code, last: report.at(-1).code, outputDirectory }, null, 2));
