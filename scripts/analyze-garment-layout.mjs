import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const loadModule = async file => {
  const bundled = await build({ entryPoints: [path.join(root, file)], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
};
const { starterGarments } = await loadModule("app/garments.ts");
const { measureGarmentAlpha, classifyGarmentLayout, matchOpenLayout } = await loadModule("app/garment-layout.ts");
const images = {};
const rows = [];
for (const garment of starterGarments) {
  let closedProfile;
  for (const source of [garment.image, garment.openImage].filter(Boolean)) {
    const bytes = await readFile(path.join(root, "public", source));
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const geometry = measureGarmentAlpha(data, info.width, info.height, { wideNeck: garment.neckline === "wide-hood" });
    let profile = classifyGarmentLayout(garment, geometry);
    if (closedProfile) {
      profile = matchOpenLayout(closedProfile, profile);
    } else closedProfile = profile;
    images[source] = {
      ...profile,
      bounds: profile.bounds.map(value => +value.toFixed(6)),
      bodyHeight: +profile.bodyHeight.toFixed(6),
      shoulderY: +profile.shoulderY.toFixed(6),
      hemY: +profile.hemY.toFixed(6),
      neckRise: +profile.neckRise.toFixed(6),
      sleeveBottoms: profile.sleeveBottoms.map(value => +value.toFixed(6)),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }
  rows.push({ id: garment.id, name: garment.name, category: garment.category, type: garment.garmentType, silhouette: garment.silhouette, ...closedProfile, image: garment.image });
}
await writeFile(path.join(root, "app/garment-layout-data.json"), JSON.stringify({ version: 2, images }, null, 2) + "\n");
const auditDir = path.join(root, ".wrangler/layout-audit");
await mkdir(auditDir, { recursive: true });
await writeFile(path.join(auditDir, "profiles.json"), JSON.stringify(rows, null, 2) + "\n");
const relevant = rows.filter(row => row.region === "upper" || row.region === "lower");
for (let start = 0; start < relevant.length; start += 48) {
  const page = relevant.slice(start, start + 48);
  const tiles = await Promise.all(page.map(async (row, index) => {
    const size = await sharp(path.join(root, "public", row.image)).metadata();
    const marks = row.region === "upper" ? Buffer.from(`<svg width="${size.width}" height="${size.height}" viewBox="0 0 1024 1280"><path d="M0 ${row.shoulderY * 1280}H1024" stroke="#d83838" stroke-width="5"/><path d="M0 ${row.hemY * 1280}H1024" stroke="#227cbd" stroke-width="5"/><path d="M40 ${row.sleeveBottoms[0] * 1280}H220 M804 ${row.sleeveBottoms[1] * 1280}H984" stroke="#268d47" stroke-width="5"/></svg>`) : undefined;
    const annotated = await sharp(path.join(root, "public", row.image)).composite(marks ? [{ input: marks }] : []).png().toBuffer();
    const image = await sharp(annotated).resize(156, 172, { fit: "contain", background: "#ececec" }).png().toBuffer();
    const label = `${row.id} | ${row.slots} slots`.replaceAll("&", "&amp;");
    const caption = Buffer.from(`<svg width="170" height="26"><text x="5" y="17" font-family="Arial" font-size="10">${label}</text></svg>`);
    return [{ input: image, left: index % 8 * 170 + 7, top: Math.floor(index / 8) * 204 }, { input: caption, left: index % 8 * 170, top: Math.floor(index / 8) * 204 + 174 }];
  }));
  await sharp({ create: { width: 1360, height: Math.ceil(page.length / 8) * 204, channels: 4, background: "#ececec" } }).composite(tiles.flat()).png().toFile(path.join(auditDir, `slots-${start / 48 + 1}.png`));
}
console.log(JSON.stringify({ garments: rows.length, images: Object.keys(images).length, slots: rows.reduce((counts, row) => { const key = `${row.region}:${row.slots}`; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}), audit: path.join(auditDir, "profiles.json") }, null, 2));
