import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const finalRoot = path.join(repoRoot, "public", "wardrobe", "final");
const cssPath = path.join(repoRoot, "app", "globals.css");
const standardPath = path.join(repoRoot, "config", "garment-standard.json");
const standard = JSON.parse(await readFile(standardPath, "utf8"));
const errors = [];

const entries = await readdir(finalRoot, { withFileTypes: true });
const principal = entries
  .filter((entry) => entry.isFile() && /^\d{7}\.png$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const open = entries
  .filter((entry) => entry.isFile() && /^\d{7}-c\.png$/.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const expectedPrincipalCount = Number(standard.catalog?.expectedPrincipalCount || 0);
if (expectedPrincipalCount > 0 && principal.length !== expectedPrincipalCount) {
  errors.push(`final/: se esperaban ${expectedPrincipalCount} prendas principales y existen ${principal.length}`);
}
for (let index = 0; index < principal.length; index += 1) {
  const expected = `${String(index + 1).padStart(7, "0")}.png`;
  if (principal[index] !== expected) {
    errors.push(`final/: secuencia interrumpida; se esperaba ${expected} y existe ${principal[index]}`);
    break;
  }
}

for (const asset of [...principal, ...open]) {
  const metadata = await sharp(path.join(finalRoot, asset)).metadata();
  if (metadata.format !== "png") errors.push(`${asset}: no es PNG`);
  if (!metadata.hasAlpha) errors.push(`${asset}: no conserva canal alpha`);
}

const manifest = await readFile(path.join(finalRoot, "manifest.csv"), "utf8");
const manifestRows = manifest.trim().split(/\r?\n/).slice(1).map((line) => {
  const match = line.match(/^"(\d{7})","(principal|abierta)",/);
  return match ? `${match[1]}${match[2] === "abierta" ? "-c" : ""}.png` : null;
});
const published = [...principal, ...open].sort();
const declared = manifestRows.filter(Boolean).sort();
if (manifestRows.some((row) => !row) || declared.length !== published.length || declared.some((row, index) => row !== published[index])) {
  errors.push("final/manifest.csv: no coincide con los archivos publicados");
}

const css = await readFile(cssPath, "utf8");
const rendererToken = standard.presentation.rendererToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rendererValues = [...css.matchAll(new RegExp(`${rendererToken}\\s*:\\s*([^;]+);`, "g"))]
  .map((match) => match[1]);
if (rendererValues.length === 0) {
  errors.push(`globals.css: falta ${standard.presentation.rendererToken}`);
}
if (
  standard.presentation.outlineAllowed === false
  && rendererValues.some((value) => /drop-shadow\(\s*[-\d.]+(?:px)?\s+[-\d.]+(?:px)?\s+0(?:px)?\s+/i.test(value))
) {
  errors.push("globals.css: el tratamiento Formé no debe dibujar contorno");
}

if (errors.length) {
  console.error(`\nGarment standard: ${errors.length} error(es)\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Garment standard OK: ${principal.length} prendas, ${open.length} variantes abiertas, una carpeta final.`,
);
