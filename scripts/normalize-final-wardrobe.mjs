import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repo = path.resolve(import.meta.dirname, "..");
const sourceDirectory = path.join(repo, "public", "wardrobe", "final");
const outputDirectory = path.join(repo, "public", "wardrobe", "normalized");
const contactSheetPath = path.join(outputDirectory, "_contact-sheet.jpg");
const canvas = { width: 1024, height: 1280 };

const rules = {
  Outerwear: { width: 0.78, height: 0.84, y: 0.50 },
  Tailoring: { width: 0.76, height: 0.82, y: 0.50 },
  Tops: { width: 0.68, height: 0.68, y: 0.48 },
  Bottoms: { width: 0.64, height: 0.80, y: 0.51 },
  Footwear: { width: 0.66, height: 0.43, y: 0.57 },
  Accessories: { width: 0.56, height: 0.38, y: 0.50 },
};

function entriesFrom(source, sectionPattern) {
  const section = source.match(sectionPattern)?.[1];
  if (!section) throw new Error("No se pudo leer una sección del catálogo.");
  return [...section.matchAll(/\{[\s\S]*?category:\s*"([^"]+)"[\s\S]*?\}/g)].map(
    (match) => match[1],
  );
}

const garmentsSource = fs.readFileSync(path.join(repo, "app", "garments.ts"), "utf8");
const importedSource = fs.readFileSync(
  path.join(repo, "app", "imported-garments-2026-07-18.ts"),
  "utf8",
);
const categories = [
  ...entriesFrom(garmentsSource, /const archive: ArchiveEntry\[\] = \[([\s\S]*?)\n\];/),
  ...[...importedSource.matchAll(/\{[\s\S]*?category:\s*"([^"]+)"[\s\S]*?\}/g)].map(
    (match) => match[1],
  ),
  ...entriesFrom(garmentsSource, /const basics: BasicEntry\[\] = \[([\s\S]*?)\n\];/),
];

if (categories.length !== 170) {
  throw new Error(`Se esperaban 170 categorías y se leyeron ${categories.length}.`);
}

function alphaBounds({ data, info }) {
  const channels = info.channels;
  const alphaChannel = channels - 1;
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * channels + alphaChannel] > 3) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < left || bottom < top) throw new Error("Imagen sin píxeles visibles.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function unionBounds(first, second) {
  if (!second) return first;
  const left = Math.min(first.left, second.left);
  const top = Math.min(first.top, second.top);
  const right = Math.max(first.right, second.right);
  const bottom = Math.max(first.bottom, second.bottom);
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

async function readBounds(file) {
  const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return alphaBounds(raw);
}

async function normalize(file, output, bounds, rule) {
  const scale = Math.min(
    (canvas.width * rule.width) / bounds.width,
    (canvas.height * rule.height) / bounds.height,
  );
  const width = Math.max(1, Math.round(bounds.width * scale));
  const height = Math.max(1, Math.round(bounds.height * scale));
  const left = Math.round((canvas.width - width) / 2);
  const centerY = canvas.height * rule.y;
  const top = Math.round(centerY - height / 2);
  const metadata = await sharp(file).metadata();
  const paddedWidth = Math.max(metadata.width ?? 0, bounds.right + 1);
  const paddedHeight = Math.max(metadata.height ?? 0, bounds.bottom + 1);
  const padded = await sharp({
    create: {
      width: paddedWidth,
      height: paddedHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: file, left: 0, top: 0 }])
    .png()
    .toBuffer();
  const layer = await sharp(padded)
    .extract({ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height })
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: canvas.width,
      height: canvas.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: layer, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(output);
  return { scale, width, height, left, top };
}

fs.mkdirSync(outputDirectory, { recursive: true });
for (const name of fs.readdirSync(outputDirectory)) {
  fs.rmSync(path.join(outputDirectory, name), { force: true });
}

const report = [];
for (let index = 0; index < categories.length; index += 1) {
  const code = String(index + 1).padStart(7, "0");
  const mainName = `${code}.png`;
  const openName = `${code}-c.png`;
  const mainSource = path.join(sourceDirectory, mainName);
  const openSource = path.join(sourceDirectory, openName);
  const hasOpen = fs.existsSync(openSource);
  const mainBounds = await readBounds(mainSource);
  const openBounds = hasOpen ? await readBounds(openSource) : null;
  const sharedBounds = unionBounds(mainBounds, openBounds);
  const category = categories[index];
  const rule = rules[category];
  if (!rule) throw new Error(`No existe regla para ${category}.`);
  const transform = await normalize(
    mainSource,
    path.join(outputDirectory, mainName),
    sharedBounds,
    rule,
  );
  if (hasOpen) {
    await normalize(openSource, path.join(outputDirectory, openName), sharedBounds, rule);
  }
  report.push({
    code,
    category,
    open: hasOpen,
    sourceBounds: sharedBounds,
    outputBounds: {
      left: transform.left,
      top: transform.top,
      width: transform.width,
      height: transform.height,
    },
    scale: Number(transform.scale.toFixed(4)),
  });
}

fs.writeFileSync(path.join(outputDirectory, "normalization.json"), `${JSON.stringify(report, null, 2)}\n`);

const thumbs = [];
for (const item of report) {
  const thumb = await sharp(path.join(outputDirectory, `${item.code}.png`))
    .resize(160, 200, { fit: "contain", background: "#eeeeea" })
    .flatten({ background: "#eeeeea" })
    .jpeg({ quality: 82 })
    .toBuffer();
  thumbs.push({
    input: thumb,
    left: (thumbs.length % 10) * 160,
    top: Math.floor(thumbs.length / 10) * 200,
  });
}
await sharp({
  create: {
    width: 1600,
    height: Math.ceil(report.length / 10) * 200,
    channels: 3,
    background: "#eeeeea",
  },
})
  .composite(thumbs)
  .jpeg({ quality: 86 })
  .toFile(contactSheetPath);

console.log(
  JSON.stringify(
    {
      prendas: report.length,
      abiertas: report.filter((item) => item.open).length,
      carpeta: outputDirectory,
      contacto: contactSheetPath,
    },
    null,
    2,
  ),
);
