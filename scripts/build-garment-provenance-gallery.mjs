import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const repo = path.resolve(import.meta.dirname, "..");
const closet = path.resolve(repo, "..", "Tata's Closet");
const outDir = path.join(repo, "tmp", "garment-provenance-visual-2026-07-26");
const thumbsDir = path.join(outDir, "thumbs");
const batchDir = path.join(repo, "tmp", "garment-pipeline", "FORME-BURNED-BORDER-2026-07-26");

for (const folder of ["source", "intermediate", "complete", "canvas", "generated-main", "generated-alt"]) {
  fs.mkdirSync(path.join(thumbsDir, folder), { recursive: true });
}

const read = (file) => fs.readFileSync(file, "utf8");

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\"") {
      if (quoted && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  values.push(current);
  return values;
}

function parseCsv(file) {
  const [headerLine, ...lines] = read(file).trim().split(/\r?\n/);
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCatalog() {
  const garmentsSource = read(path.join(repo, "app", "garments.ts"));
  const importsSource = read(path.join(repo, "app", "imported-garments-2026-07-18.ts"));
  const archiveBlock = garmentsSource.slice(
    garmentsSource.indexOf("const archive"),
    garmentsSource.indexOf("const basics"),
  );
  const basicsBlock = garmentsSource.slice(
    garmentsSource.indexOf("const basics"),
    garmentsSource.indexOf("export const formeBasics"),
  );

  const archive = [...archiveBlock.matchAll(
    /\{\s*file:\s*"([^"]+)"(?:,\s*openFile:\s*"([^"]+)")?,\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*color:\s*"([^"]+)"/g,
  )].map((match) => ({
    group: "Outwear",
    file: match[1],
    openFile: match[2] || "",
    name: match[3],
    category: match[4],
    color: match[5],
  }));

  const imported = [...importsSource.matchAll(
    /\{\s*file:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*color:\s*"([^"]+)"/g,
  )].map((match) => ({
    group: "Pants & Sneakers",
    file: match[1],
    openFile: "",
    name: match[2],
    category: match[3],
    color: match[4],
  }));

  const basics = [...basicsBlock.matchAll(
    /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*category:\s*"([^"]+)",\s*color:\s*"([^"]+)",\s*image:\s*"([^"]+)"/g,
  )].map((match) => ({
    group: "Básicos Formé",
    id: match[1],
    file: path.basename(match[5]),
    image: match[5],
    openFile: "",
    name: match[2],
    category: match[3],
    color: match[4],
  }));

  return { archive, imported, basics };
}

const catalog = parseCatalog();
const intakeRows = parseCsv(path.join(
  repo,
  "public",
  "wardrobe",
  "imports",
  "2026-07-18",
  "audit",
  "manifest-104.csv",
));
const intakeByFile = new Map(intakeRows.map((row) => [row.current_import, row]));

const finalRows = parseCsv(path.join(closet, "Final", "manifest.csv"));
const finalByArchiveAsset = new Map();
const finalByImportAsset = new Map();
for (const row of finalRows) {
  const assets = row.forme_assets.split("|").map((asset) => asset.trim());
  for (const asset of assets) {
    const basename = path.basename(asset);
    if (asset.includes("/wardrobe/cutouts/")) finalByArchiveAsset.set(basename, row);
    if (asset.includes("/wardrobe/imports/")) finalByImportAsset.set(basename, row);
  }
}

const reconciliationRows = parseCsv(path.join(
  batchDir,
  "evidence",
  "receipts",
  "batch-reconciler-matrix.csv",
));
const reconciliationBySource = new Map(reconciliationRows.map((row) => [row.source_id, row]));

const cleanedBasics = new Set([
  "blue-straight-jeans.webp",
  "washed-black-jeans.webp",
  "black-wide-trousers.webp",
  "stone-pleated-chinos.webp",
  "basic-white-tee.webp",
  "oversized-black-tee.webp",
  "blue-long-sleeve-shirt.webp",
  "black-short-sleeve-shirt.webp",
]);

function outwearIntermediate(item, sourceId) {
  const reconciliation = reconciliationBySource.get(sourceId);
  if (!reconciliation) {
    const historical = path.join(closet, "Outwear", "Generated_4x5_Ghost", item.file.replace(".webp", ".png"));
    return fs.existsSync(historical)
      ? {
          path: historical,
          label: "Generación histórica; no fue tocada en el lote 2026-07-26",
          relation: "used-historical",
        }
      : null;
  }

  if (sourceId === "031_DSC01835") {
    const rejected = path.join(batchDir, "generated", "031_DSC01835-r6-chroma.png");
    return fs.existsSync(rejected)
      ? {
          path: rejected,
          label: "Intento generado descartado; el resultado publicado conservó el master anterior",
          relation: "rejected",
        }
      : null;
  }

  let filename = `${sourceId}-r2-chroma.png`;
  if (reconciliation.revision === "r3" || reconciliation.revision === "r3-scale-r1") {
    filename = `${sourceId}-r3-chroma.png`;
  } else if (reconciliation.revision === "r5") {
    filename = `${sourceId}-r5-chroma.png`;
  } else if (reconciliation.revision === "primary-r4") {
    filename = `${sourceId}-primary-r4-chroma.png`;
  }
  const candidate = path.join(batchDir, "generated", filename);
  return fs.existsSync(candidate)
    ? {
        path: candidate,
        label: `Generación usada por el resultado publicado · revisión ${reconciliation.revision}`,
        relation: "used",
      }
    : null;
}

function pantsIntermediate(finalRow) {
  if (!finalRow) return null;
  const code = finalRow.code;
  const chroma = path.join(repo, "tmp", "imagegen", code, "generated-chroma.png");
  if (!fs.existsSync(chroma)) return null;
  return {
    path: chroma,
    label: "Artefacto generado conservado; el repositorio no guarda el recibo de hash que lo vincule al resultado",
    relation: "unverified",
  };
}

function pantsProvenance(item, intake) {
  const status = intake?.status?.trim();
  if (status === "aceptada") {
    return {
      key: "generated",
      label: "GENERADA",
      detail: "La comparación RAW → resultado confirma reconstrucción: cambian pose, silueta y pliegues. «aceptada» solo era un estado de revisión.",
    };
  }
  if (status === "aceptada_generada") {
    return {
      key: "generated",
      label: "GENERADA",
      detail: "Prenda omitida del lote inicial y reconstruida con ImageGen",
    };
  }
  if (status === "rechazada_rojo") {
    return {
      key: "generated",
      label: "GENERADA",
      detail: item.file === "028_DSC01963.webp"
        ? "Generación rechazada; sigue visible únicamente para revisión"
        : "Output marcado en rojo y rehecho con ImageGen",
    };
  }
  return {
    key: "unknown",
    label: "SIN EVIDENCIA",
    detail: `Estado de manifiesto no reconocido: ${status || "vacío"}`,
  };
}

function imageResultPath(item) {
  if (item.group === "Outwear") {
    return path.join(repo, "public", "wardrobe", "clean", item.file);
  }
  if (item.group === "Pants & Sneakers") {
    return path.join(repo, "public", "wardrobe", "imports", "2026-07-18", item.file);
  }
  return path.join(repo, "public", item.image.replace(/^\//, ""));
}

function sourcePathFor(item, finalRow) {
  if (!finalRow) return null;
  return path.join(closet, finalRow.source_folder, finalRow.previous_file);
}

function pantsQuality(item, intake) {
  if (item.file === "028_DSC01963.webp") {
    return {
      key: "regenerate",
      label: "REGENERAR",
      detail: "Cuello/óvalo blanco inventado; no es calidad de producción",
    };
  }
  if (intake?.status?.trim() === "aceptada") {
    return {
      key: "review",
      label: "QA REABIERTO",
      detail: "La aprobación histórica no sirve como control de procedencia ni de fidelidad; debe verificarse contra el RAW",
    };
  }
  return {
    key: "accepted",
    label: "RESULTADO ACTIVO",
    detail: "La app usa actualmente este archivo; la procedencia no implica que su calidad sea correcta",
  };
}

async function makeRawThumb(input, output) {
  const extracted = spawnSync("dcraw", ["-e", "-c", input], {
    encoding: null,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (extracted.status !== 0 || !extracted.stdout?.length) {
    throw new Error(`No se pudo extraer thumbnail RAW: ${input}\n${extracted.stderr?.toString() || ""}`);
  }
  await sharp(extracted.stdout)
    .rotate()
    .resize(420, 525, {
      fit: "contain",
      background: { r: 218, g: 218, b: 214, alpha: 1 },
    })
    .webp({ quality: 82 })
    .toFile(output);
}

async function makeImageThumb(input, output, preserveAlpha = true) {
  const background = preserveAlpha
    ? { r: 0, g: 0, b: 0, alpha: 0 }
    : { r: 218, g: 218, b: 214, alpha: 1 };
  let image = sharp(input)
    .rotate()
    .resize(420, 525, { fit: "contain", background });
  if (!preserveAlpha) {
    image = image.flatten({ background });
  }
  await image
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(output);
}

function htmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function rel(file) {
  return path.relative(outDir, file).split(path.sep).join("/");
}

const items = [];

for (const item of catalog.archive) {
  const finalRow = finalByArchiveAsset.get(item.file);
  const sourceId = item.file.replace(/\.webp$/, "");
  const intermediate = outwearIntermediate(item, sourceId);
  const reconciliation = reconciliationBySource.get(sourceId);
  items.push({
    ...item,
    sourceId,
    finalRow,
    sourcePath: sourcePathFor(item, finalRow),
    intermediate,
    completePath: imageResultPath(item),
    canvasPath: item.openFile
      ? path.join(repo, "public", "wardrobe", "clean", item.openFile)
      : imageResultPath(item),
    canvasRole: item.openFile ? "VARIANTE ABIERTA / CANVAS" : "FALLBACK: CANVAS USA COMPLETA",
    quality: {
      key: "accepted",
      label: "RESULTADO ACTIVO",
      detail: "La app usa actualmente este archivo",
    },
    provenance: {
      key: "generated",
      label: "GENERADA",
      detail: sourceId === "031_DSC01835"
        ? "Master generado previamente; en el último lote solo se limpió alpha/borde"
        : reconciliation
          ? "Imagen regenerada y publicada en el lote 2026-07-26"
          : "Master generado previamente; sin cambios en el lote 2026-07-26",
    },
  });
}

for (const item of catalog.imported) {
  const intake = intakeByFile.get(item.file);
  const finalRow = finalByImportAsset.get(item.file);
  const provenance = pantsProvenance(item, intake);
  items.push({
    ...item,
    sourceId: item.file.replace(/\.webp$/, ""),
    finalRow,
    sourcePath: sourcePathFor(item, finalRow),
    intermediate: pantsIntermediate(finalRow),
    completePath: imageResultPath(item),
    canvasPath: imageResultPath(item),
    canvasRole: "FALLBACK: CANVAS USA COMPLETA",
    intakeStatus: intake?.status?.trim() || "",
    quality: pantsQuality(item, intake),
    provenance,
  });
}

for (const item of catalog.basics) {
  items.push({
    ...item,
    sourceId: item.id,
    finalRow: null,
    sourcePath: null,
    intermediate: null,
    completePath: imageResultPath(item),
    canvasPath: imageResultPath(item),
    canvasRole: "FALLBACK: CANVAS USA COMPLETA",
    quality: {
      key: "unknown",
      label: "SIN QA DE FUENTE",
      detail: "No pertenece a las dos carpetas fuente del closet personal",
    },
    provenance: {
      key: "unknown",
      label: "SIN RECIBO",
      detail: cleanedBasics.has(item.file)
        ? "Sin fuente documentada; alpha limpiado localmente y aún no publicado"
        : "No pertenece a las dos carpetas fuente y no tiene recibo de procedencia",
    },
  });
}

let processed = 0;
for (const item of items) {
  const slug = `${String(processed + 1).padStart(3, "0")}-${item.sourceId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  item.slug = slug;
  if (item.sourcePath && fs.existsSync(item.sourcePath)) {
    const sourceThumb = path.join(thumbsDir, "source", `${slug}.webp`);
    await makeRawThumb(item.sourcePath, sourceThumb);
    item.sourceThumb = rel(sourceThumb);
  }
  if (item.intermediate?.path && fs.existsSync(item.intermediate.path)) {
    const intermediateThumb = path.join(thumbsDir, "intermediate", `${slug}.webp`);
    await makeImageThumb(item.intermediate.path, intermediateThumb, false);
    item.intermediateThumb = rel(intermediateThumb);
  }
  if (fs.existsSync(item.completePath)) {
    const completeThumb = path.join(thumbsDir, "complete", `${slug}.webp`);
    await makeImageThumb(item.completePath, completeThumb, true);
    item.completeThumb = rel(completeThumb);

    const generatedMainThumb = path.join(thumbsDir, "generated-main", `${slug}.webp`);
    const generatedMainPath = item.intermediate?.path && fs.existsSync(item.intermediate.path)
      ? item.intermediate.path
      : item.completePath;
    await makeImageThumb(generatedMainPath, generatedMainThumb, false);
    item.generatedMainThumb = rel(generatedMainThumb);
  }
  if (item.openFile && fs.existsSync(item.canvasPath)) {
    const canvasThumb = path.join(thumbsDir, "canvas", `${slug}.webp`);
    await makeImageThumb(item.canvasPath, canvasThumb, true);
    item.canvasThumb = rel(canvasThumb);

    const generatedAltThumb = path.join(thumbsDir, "generated-alt", `${slug}.webp`);
    const preservedOpenGeneration = item.finalRow?.code
      ? path.join(repo, "tmp", "imagegen", item.finalRow.code, "generated-chroma-open.png")
      : "";
    const generatedAltPath = preservedOpenGeneration && fs.existsSync(preservedOpenGeneration)
      ? preservedOpenGeneration
      : item.canvasPath;
    await makeImageThumb(generatedAltPath, generatedAltThumb, false);
    item.generatedAltThumb = rel(generatedAltThumb);
  } else {
    item.canvasThumb = item.completeThumb;
  }
  processed += 1;
  if (processed % 20 === 0 || processed === items.length) {
    console.log(`Procesadas ${processed}/${items.length}`);
  }
}

const counts = items.reduce((summary, item) => {
  summary[item.provenance.key] = (summary[item.provenance.key] || 0) + 1;
  summary.quality[item.quality.key] = (summary.quality[item.quality.key] || 0) + 1;
  if (item.openFile) summary.open += 1;
  return summary;
}, { generated: 0, directPhoto: 0, unknown: 0, open: 0, quality: {} });

function imageCell(title, image, selectionId, item) {
  const checkboxId = `check-${selectionId.replaceAll(/[^a-zA-Z0-9_-]/g, "-")}`;
  const content = image
    ? `<img src="${htmlEscape(image)}" alt="${htmlEscape(title)}" loading="lazy">`
    : `<div class="empty" aria-hidden="true"></div>`;
  const checkbox = image
    ? `<input
        id="${htmlEscape(checkboxId)}"
        type="checkbox"
        data-selection="${htmlEscape(selectionId)}"
        data-file="${htmlEscape(item.file)}"
        data-group="${htmlEscape(item.group)}"
        data-result="${htmlEscape(title)}"
        aria-label="Marcar ${htmlEscape(item.file)} · ${htmlEscape(title)}">`
    : "";
  return `
    <figure class="visual${image ? "" : " missing"}">
      <figcaption><span>${htmlEscape(title)}</span>${checkbox}</figcaption>
      ${image
        ? `<label class="image-stage" for="${htmlEscape(checkboxId)}">${content}</label>`
        : `<div class="image-stage">${content}</div>`}
    </figure>`;
}

const cards = items.map((item, index) => {
  const selectionBase = `${item.group}:${item.file}`;
  return `
    <article class="garment" data-kind="${htmlEscape(item.provenance.key)}" data-quality="${htmlEscape(item.quality.key)}" data-group="${htmlEscape(item.group)}" data-search="${htmlEscape(`${item.file} ${item.name} ${item.category} ${item.provenance.label} ${item.quality.label}`.toLowerCase())}">
      <header class="garment-header">
        <span class="index">${String(index + 1).padStart(3, "0")} / ${items.length}</span>
        <p class="id">${htmlEscape(item.file)}</p>
      </header>
      <div class="visual-grid">
        ${imageCell("1. GENERADA", item.generatedMainThumb, `${selectionBase}:generated-main`, item)}
        ${imageCell("2. CALADA", item.completeThumb, `${selectionBase}:cutout-main`, item)}
        ${imageCell("3. GENERADA", item.generatedAltThumb, `${selectionBase}:generated-alt`, item)}
        ${imageCell("4. CALADA", item.openFile ? item.canvasThumb : "", `${selectionBase}:cutout-alt`, item)}
      </div>
    </article>`;
}).join("\n");

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Formé · Auditoría visual de procedencia</title>
  <style>
    :root {
      color-scheme: light;
      --paper: #efefeb;
      --ink: #10120f;
      --muted: #696b66;
      --line: rgba(16, 18, 15, .14);
      --accent: #f0442f;
      --generated: #b8ff59;
      --direct-photo: #8fd7ff;
      --review: #ffcb57;
      font-family: Arial, Helvetica, sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--paper); color: var(--ink); }
    .top {
      position: sticky; top: 0; z-index: 20;
      background: rgba(239, 239, 235, .94);
      backdrop-filter: blur(16px);
      padding: 22px 28px 18px;
      border-bottom: 1px solid var(--line);
    }
    .top-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
    h1 { margin: 0; font-size: clamp(24px, 3vw, 48px); letter-spacing: -.05em; }
    .summary { margin: 8px 0 0; color: var(--muted); font-size: 13px; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
    button, input[type="search"] {
      appearance: none; border: 0; background: transparent; color: inherit;
      font: inherit; padding: 10px 12px;
    }
    button { cursor: pointer; border-radius: 999px; background: rgba(16, 18, 15, .08); }
    button.active { background: var(--ink); color: var(--paper); }
    input[type="search"] { min-width: min(320px, 100%); border-bottom: 1px solid var(--ink); margin-left: auto; }
    main { padding: 0 28px 80px; }
    .garment { padding: 34px 0 40px; border-bottom: 1px solid var(--line); }
    .garment[hidden] { display: none; }
    .garment-header { margin-bottom: 18px; }
    .index, figcaption, .id { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
    .index { font-size: 11px; color: var(--muted); }
    .id { margin: 5px 0 0; font-size: 14px; color: var(--ink); font-weight: 700; }
    .visual-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .visual { margin: 0; min-width: 0; }
    figcaption {
      min-height: 28px; padding: 0 2px 8px;
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      font-size: 10px;
    }
    figcaption input {
      appearance: auto; width: 18px; height: 18px; padding: 0; margin: 0;
      accent-color: var(--accent); cursor: pointer;
    }
    .image-stage {
      position: relative; aspect-ratio: 4 / 5; overflow: hidden;
      display: block; cursor: pointer;
      background-color: #dadad6;
      background-image:
        linear-gradient(45deg, rgba(255,255,255,.45) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(255,255,255,.45) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(255,255,255,.45) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(255,255,255,.45) 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0;
    }
    .visual:has(input:checked) .image-stage {
      outline: 3px solid var(--accent);
      outline-offset: -3px;
    }
    .visual.missing { opacity: .22; }
    .visual.missing .image-stage { cursor: default; }
    img { width: 100%; height: 100%; display: block; object-fit: contain; }
    .empty { height: 100%; }
    @media (max-width: 900px) {
      .top-row { display: block; }
      input[type="search"] { width: 100%; margin-left: 0; }
      .visual-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 24px; }
    }
    @media (max-width: 540px) {
      .top, main { padding-left: 14px; padding-right: 14px; }
      .visual-grid { grid-template-columns: 1fr; }
      .image-stage { max-height: 76vh; }
    }
  </style>
</head>
<body>
  <header class="top">
    <div class="top-row">
      <div>
        <h1>Formé · Auditoría visual</h1>
        <p class="summary">${items.length} prendas</p>
      </div>
      <p class="summary"><span id="selected-count">0 marcadas</span> · <span id="visible-count">${items.length} visibles</span></p>
    </div>
    <div class="controls">
      <button class="active" data-filter="all">Todas</button>
      <button data-quality-filter="review">QA reabierto</button>
      <button data-quality-filter="regenerate">Regenerar</button>
      <button data-filter="unknown">Sin recibo</button>
      <button id="save-selection" type="button">Guardar lista</button>
      <input id="search" type="search" placeholder="Buscar archivo">
    </div>
  </header>
  <main>${cards}</main>
  <script>
    const cards = [...document.querySelectorAll(".garment")];
    const buttons = [...document.querySelectorAll("[data-filter]")];
    const qualityButtons = [...document.querySelectorAll("[data-quality-filter]")];
    const search = document.querySelector("#search");
    const visibleCount = document.querySelector("#visible-count");
    const selectedCount = document.querySelector("#selected-count");
    const saveSelection = document.querySelector("#save-selection");
    const checkboxes = [...document.querySelectorAll("[data-selection]")];
    const storageKey = "forme-garment-review-selections-v1";
    let selections = {};
    try {
      selections = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      selections = {};
    }
    function updateSelectedCount() {
      const list = getSelectionList();
      selectedCount.textContent = list.length + " marcadas";
      selectedCount.dataset.savedList = JSON.stringify(list);
    }
    function getSelectionList() {
      return checkboxes
        .filter((checkbox) => selections[checkbox.dataset.selection])
        .map((checkbox) => ({
          id: checkbox.dataset.selection,
          file: checkbox.dataset.file,
          group: checkbox.dataset.group,
          result: checkbox.dataset.result,
        }));
    }
    window.getFormeReviewSelections = getSelectionList;
    for (const checkbox of checkboxes) {
      checkbox.checked = Boolean(selections[checkbox.dataset.selection]);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) selections[checkbox.dataset.selection] = true;
        else delete selections[checkbox.dataset.selection];
        localStorage.setItem(storageKey, JSON.stringify(selections));
        updateSelectedCount();
      });
    }
    updateSelectedCount();
    saveSelection.addEventListener("click", () => {
      const payload = {
        savedAt: new Date().toISOString(),
        total: getSelectionList().length,
        selections: getSelectionList(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "forme-cambios.json";
      link.click();
      URL.revokeObjectURL(url);
    });
    let activeFilter = "all";
    let activeQualityFilter = "all";
    function applyFilters() {
      const term = search.value.trim().toLowerCase();
      let visible = 0;
      for (const card of cards) {
        const matchesFilter = activeFilter === "all" || card.dataset.kind === activeFilter;
        const matchesQuality = activeQualityFilter === "all" || card.dataset.quality === activeQualityFilter;
        const matchesTerm = !term || card.dataset.search.includes(term);
        card.hidden = !(matchesFilter && matchesQuality && matchesTerm);
        if (!card.hidden) visible += 1;
      }
      visibleCount.textContent = visible + " visibles";
    }
    for (const button of buttons) {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;
        activeQualityFilter = "all";
        buttons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
        qualityButtons.forEach((candidate) => candidate.classList.remove("active"));
        applyFilters();
      });
    }
    for (const button of qualityButtons) {
      button.addEventListener("click", () => {
        activeFilter = "all";
        activeQualityFilter = button.dataset.qualityFilter;
        buttons.forEach((candidate) => candidate.classList.remove("active"));
        qualityButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
        applyFilters();
      });
    }
    search.addEventListener("input", applyFilters);
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  counts,
  items: items.map((item) => ({
    file: item.file,
    name: item.name,
    group: item.group,
    category: item.category,
    intakeStatus: item.intakeStatus,
    provenance: item.provenance,
    quality: item.quality,
    slug: item.slug,
    sourceThumb: item.sourceThumb,
    intermediateThumb: item.intermediateThumb,
    completeThumb: item.completeThumb,
    canvasThumb: item.canvasThumb,
    generatedMainThumb: item.generatedMainThumb,
    generatedAltThumb: item.generatedAltThumb,
    sourcePath: item.sourcePath,
    intermediate: item.intermediate,
    completePath: item.completePath,
    canvasPath: item.canvasPath,
    canvasRole: item.canvasRole,
    openFile: item.openFile,
  })),
}, null, 2));

console.log(`Galería: ${path.join(outDir, "index.html")}`);
console.log(`Conteos: ${JSON.stringify(counts)}`);
