import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repo = path.resolve(import.meta.dirname, "..");
const galleryDir = path.join(repo, "tmp", "garment-provenance-visual-2026-07-26");
const manifest = JSON.parse(fs.readFileSync(path.join(galleryDir, "manifest.json"), "utf8"));
const outputDir = path.join(galleryDir, "contact-sheets");
fs.mkdirSync(outputDir, { recursive: true });

const acceptedLegacy = manifest.items.filter(
  (item) => item.group === "Pants & Sneakers" && item.intakeStatus === "aceptada",
);

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll("\"", "&quot;");

async function makeTile(item) {
  const width = 840;
  const height = 600;
  const source = await sharp(path.join(galleryDir, item.sourceThumb))
    .resize(400, 500, { fit: "contain" })
    .toBuffer();
  const result = await sharp(path.join(galleryDir, item.completeThumb))
    .resize(400, 500, { fit: "contain" })
    .toBuffer();
  const label = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#efefeb"/>
      <text x="20" y="30" font-family="Arial" font-size="20" font-weight="700" fill="#10120f">${escapeXml(item.file)} · ${escapeXml(item.name)}</text>
      <text x="20" y="56" font-family="Arial" font-size="14" fill="#5f625c">RAW FÍSICO</text>
      <text x="440" y="56" font-family="Arial" font-size="14" fill="#5f625c">RESULTADO ACTIVO · GENERADO</text>
      <line x1="420" y1="50" x2="420" y2="590" stroke="#b7b9b4"/>
    </svg>
  `);

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: "#efefeb",
    },
  })
    .composite([
      { input: label, left: 0, top: 0 },
      { input: source, left: 10, top: 80 },
      { input: result, left: 430, top: 80 },
    ])
    .png()
    .toBuffer();
}

const pageSize = 10;
for (let pageIndex = 0; pageIndex < Math.ceil(acceptedLegacy.length / pageSize); pageIndex += 1) {
  const pageItems = acceptedLegacy.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  const tiles = await Promise.all(pageItems.map(makeTile));
  const pageWidth = 1680;
  const pageHeight = Math.ceil(pageItems.length / 2) * 600;
  const composites = tiles.map((input, index) => ({
    input,
    left: (index % 2) * 840,
    top: Math.floor(index / 2) * 600,
  }));
  const filename = `legacy-accepted-${String(pageIndex + 1).padStart(2, "0")}.webp`;
  await sharp({
    create: {
      width: pageWidth,
      height: pageHeight,
      channels: 4,
      background: "#d8d8d3",
    },
  })
    .composite(composites)
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(path.join(outputDir, filename));
  console.log(path.join(outputDir, filename));
}

console.log(`Prendas incluidas: ${acceptedLegacy.length}`);
