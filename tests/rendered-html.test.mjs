import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { inflateSync } from "node:zlib";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("public Looks keeps the gallery without the unfinished weekly planner", async () => {
  const features = await readFile(new URL("../app/product-features.ts", import.meta.url), "utf8");
  const source = await readFile(new URL("../app/wardrobe-app.tsx", import.meta.url), "utf8");
  assert.match(features, /weeklyPlanner: false/);
  assert.match(source, /productFeatures\.weeklyPlanner && <WeeklyPlanView/);
  assert.match(source, /productFeatures\.weeklyPlanner \? fetch\("\/api\/week"/);
  assert.match(source, /productFeatures\.weeklyPlanner && <div><dt>Días planeados/);
  const html = await (await render("/looks")).text();
  assert.match(html, /saved-looks-grid/);
  assert.match(html, /Crear look/);
  assert.doesNotMatch(html, /Tu semana|PLANEAR SEMANA|DÍAS LISTOS|Cambia el look de|week-planner|week-strip-preview/);
});

test("Forme favicons are solid red squares with fresh references on app and About", async () => {
  const svg = await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8");
  assert.match(svg, /<rect width="32" height="32" fill="#ff0000"/);
  assert.doesNotMatch(svg, /<path|rx=/);
  for (const [name, size] of [["favicon-16x16.png", 16], ["favicon-32x32.png", 32], ["apple-touch-icon.png", 180]]) {
    const png = await readFile(new URL(`../public/${name}`, import.meta.url));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    const compressed = [];
    for (let offset = 8; offset < png.length;) {
      const length = png.readUInt32BE(offset);
      if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") compressed.push(png.subarray(offset + 8, offset + 8 + length));
      offset += length + 12;
    }
    const rgb = inflateSync(Buffer.concat(compressed));
    for (let y = 0; y < size; y++) {
      const start = y * (size * 3 + 1);
      assert.equal(rgb[start], 0);
      for (let x = 0; x < size; x++) assert.deepEqual([...rgb.subarray(start + 1 + x * 3, start + 4 + x * 3)], [255, 0, 0]);
    }
  }
  for (const route of ["/looks", "/closet", "/canvas", "/about"]) {
    const html = await (await render(route)).text();
    assert.match(html, /favicon[^"<>]*\?v=forme-red-1/);
    assert.match(html, /apple-touch-icon\.png\?v=forme-red-1/);
  }
});

test("keeps the main product areas on stable routes", async () => {
  const routes = ["/about", "/closet", "/looks", "/canvas", "/pricing", "/perfil", "/ajustes"];
  const responses = await Promise.all(routes.map((route) => render(route)));
  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 200, `${routes[index]} should render`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  }

  const about = await responses[0].text();
  const pricing = await responses[4].text();
  assert.match(about, /Formé® convierte tu closet/);
  assert.match(about, /about\.forme-f18\.js/);
  assert.match(about, /forme-social-instagram-v1\.gif/);
  assert.match(pricing, /Tu closet,/);
  const assistant = await render("/asistente");
  assert.equal(assistant.status, 307);
  assert.equal(new URL(assistant.headers.get("location")).pathname, "/canvas");

  const [pricingSource, publicProfileSource, closetSource, looksSource, canvasSource, profileSource] = await Promise.all([
    readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[handle]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/closet/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/looks/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/canvas/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/perfil/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(pricingSource, /name: "Personal", monthly: 7\.99, annual: 79\.99/);
  assert.match(pricingSource, /name: "Club", monthly: 12\.99, annual: 129\.99/);
  assert.match(pricingSource, /10 prendas de por vida y hasta 5 looks guardados/);
  assert.match(pricingSource, /\/api\/sales-interest/);
  assert.match(publicProfileSource, /className="public-profile-frame"/);
  assert.match(publicProfileSource, /Aún no hay prendas ni looks publicados\./);
  assert.doesNotMatch(publicProfileSource, /join\(" · "\)/);
  assert.match(closetSource, /WardrobeApp initialRoute="closet"/);
  assert.match(looksSource, /WardrobeApp initialRoute="looks"/);
  assert.match(canvasSource, /WardrobeApp initialRoute="canvas"/);
  assert.match(profileSource, /WardrobeApp initialRoute="perfil"/);
  assert.doesNotMatch(`${closetSource}${looksSource}${canvasSource}${profileSource}`, /closetVariant/);
});

test("redirects the brand entry to About and server-renders the wardrobe", async () => {
  const homeSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(homeSource, /["']use client["']|WardrobeApp/);

  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://localhost/about");

  const aboutResponse = await render("/about");
  assert.equal(aboutResponse.status, 200);
  const html = await aboutResponse.text();
  assert.match(html, /<title>Formé®\. Tu closet digital\.<\/title>/i);
  assert.match(html, /Formé® convierte tu closet/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);

  const closetResponse = await render("/closet");
  assert.equal(closetResponse.status, 200);
  const closetHtml = await closetResponse.text();
  assert.doesNotMatch(closetHtml, /CLOSET DE PRUEBA/);
  assert.match(closetHtml, /class="topbar-inner"/);
  assert.doesNotMatch(closetHtml, /＋ Agregar/);
  assert.match(closetHtml, /aria-label="Revisando sesión"/);
});

test("reserves the page scrollbar gutter across Closet and Canvas", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const rootRule = css.match(/(?:^|\n)html\s*\{([^}]+)\}/)?.[1] ?? "";
  assert.match(rootRule, /scrollbar-gutter:\s*stable\s*;/);
});

test("hides Assistant and the style test without deleting their implementation", async () => {
  for (const route of ["/closet", "/canvas", "/looks", "/pricing", "/canvas/mix-match"]) {
    const html = await (await render(route)).text();
    const navigation = [...html.matchAll(/<nav\b[^>]*>[\s\S]*?<\/nav>/g)].map(match => match[0]).join("\n");
    assert.doesNotMatch(navigation, /Asistente|href="\/asistente"|onClick="generateLooksQuickly"/);
  }
  const features = await readFile(new URL("../app/product-features.ts", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/wardrobe-app.tsx", import.meta.url), "utf8");
  assert.match(features, /assistant: false, styleTest: false/);
  assert.match(page, /setStyleOnboardingOpen\(productFeatures\.styleTest && !loadedStyleProfile\.completed\)/);
  assert.match(page, /productFeatures\.styleTest && !demoMode && styleOnboardingOpen && <StyleOnboarding/);
  assert.match(page, /productFeatures\.styleTest && <button className="profile-recalibrate"/);
  assert.match(page, /productFeatures\.assistant && <button type="button" onClick={generateLooksQuickly}/);
});

test("duplicating an archived look uses that look, preserves placement and opens a separate copy", async () => {
  const page = await readFile(new URL("../app/wardrobe-app.tsx", import.meta.url), "utf8");
  const duplication = page.slice(page.indexOf("async function duplicateLook("), page.indexOf("async function retryProcessing("));
  assert.match(duplication, /duplicateLook\(look.items, `\$\{look.name\} · copia`\)/);
  assert.match(duplication, /sourceItems.map\(\(item\) => \(\{ \.\.\.item, instanceId: crypto.randomUUID\(\) \}\)\)/);
  assert.match(duplication, /const outfitId = `look-\$\{crypto.randomUUID\(\)\}`/);
  assert.match(duplication, /method: "PUT"/);
  assert.match(duplication, /items: duplicatedPieces/);
  assert.match(duplication, /const nextLooks = \[nextLook, \.\.\.looks\]/);
  assert.match(duplication, /openSavedLook\(nextLook\)/);
  assert.match(duplication, /if \(!response.ok\) throw new Error/);
  assert.match(duplication, /finally \{\s*setSavingOutfit\(false\)/);
  assert.doesNotMatch(duplication, /randomGarmentReplacements|canvasPieces.map|isPublic: true/);
});

test("keeps the garment pipeline economical, reversible, and cutout-first", async () => {
  const [page, worker, schema] = await Promise.all([
    readFile(new URL("../app/wardrobe-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/wardrobe-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /fallback: ImageQuality = "low"/);
  assert.doesNotMatch(worker, /MAX_BATCH_GARMENTS/);
  assert.doesNotMatch(worker, /value\.items\.slice\(0,\s*15\)/);
  assert.doesNotMatch(worker, /slice\(0, 12\)/);
  assert.match(worker, /endpoint: "\/v1\/images\/edits"/);
  assert.match(worker, /gpt-image-2\.5-sunburst/);
  assert.match(worker, /form\.append\("background", "transparent"\)/);
  assert.match(worker, /imageGenerationCostMicrousd/);
  assert.match(worker, /status = 'awaiting_cutout'/);
  assert.match(worker, /garment\.category === "Outerwear"/);
  assert.match(worker, /garment_type/);
  assert.match(worker, /\/api\/batches\/status/);
  assert.match(await readFile(new URL("../app/garment-upload.ts", import.meta.url), "utf8"), /function processingFileFor/);
  assert.match(page, /function whiteStudioCutout/);
  assert.match(page, /Generar de nuevo/i);
  assert.match(page, /discountedBatchThreshold = 5/);
  assert.match(schema, /processingImageKey/);
  assert.match(schema, /generatedOpenImageKey/);
  assert.match(schema, /qaStatus/);
  assert.match(schema, /profilePublic/);
  assert.match(schema, /isPublic/);
  assert.match(schema, /garmentType/);
});

test("ships one sequential final wardrobe directory", async () => {
  const [catalog, manifest, files] = await Promise.all([
    readFile(new URL("../app/imported-garments-2026-07-18.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/wardrobe/final/manifest.csv", import.meta.url), "utf8"),
    readdir(new URL("../public/wardrobe/final", import.meta.url)),
  ]);

  assert.equal((catalog.match(/\{ file: "\d{3}_DSC\d+\.webp"/g) ?? []).length, 104);
  assert.equal(files.filter((file) => /^\d{7}\.png$/.test(file)).length, 220);
  assert.equal(files.filter((file) => /^\d{7}-c\.png$/.test(file)).length, 42);
  assert.equal(manifest.trim().split("\n").length - 1, 262);
  assert.match(catalog, /category: "Bottoms"/);
  assert.match(catalog, /category: "Tops"/);
  assert.match(catalog, /category: "Footwear"/);
  assert.match(catalog, /category: "Accessories"/);
});

// User-facing contracts, rather than exact CSS declarations or icon counts.
test("the closet exposes search, collections and access to filters", async () => {
  const html = await (await render("/closet")).text();
  assert.match(html, /<h1[^>]*>Mi closet<\/h1>/);
  assert.match(html, /type="search"/);
  assert.match(html, /Buscar prendas/);
  assert.match(html, /Filtrar y ordenar prendas/);
  assert.match(html, /aria-label="Favoritas"[^>]*aria-pressed="false"/);
  assert.match(html, /aria-label="Tamaño de miniaturas"/);
  assert.match(html, /Básicos Formé/);
  assert.doesNotMatch(html, /closet-looks-nav/);
});

test("Canvas keeps its garment library and iteration actions visible; optional panels start closed", async () => {
  const html = await (await render("/canvas")).text();
  assert.match(html, /Nombre del look/);
  assert.match(html, /id="look-name"/);
  assert.match(html, /Guardar look/);
  assert.match(html, /aria-label="Deshacer"/);
  assert.match(html, /<aside[^>]+id="canvas-garment-library"/);
  assert.match(html, /aria-label="Crear y probar looks"/);
  assert.match(html, /Nuevo look/);
  assert.match(html, /Mezclar/);
  assert.doesNotMatch(html, /Ajustar look con IA/);
  assert.match(html, /aria-label="Favoritas"[^>]*aria-pressed="false"/);
  assert.match(html, /aria-label="Tamaño de miniaturas"/);
  assert.match(html, /aria-controls="canvas-layers"/);
  assert.match(html, /aria-controls="canvas-saved-looks"/);
  assert.doesNotMatch(html, /<aside[^>]+id="canvas-(layers|saved-looks)"/);
});

test("Canvas automatically refines new and mixed garments without an adjustment control", async () => {
  const page = await readFile(new URL("../app/wardrobe-app.tsx", import.meta.url), "utf8");
  assert.match(page, /fetch\("\/api\/canvas-placement"/);
  assert.match(page, /void arrangeCanvasAutomatically\(next, generationAtStart\)/);
  assert.match(page, /await arrangeCanvasAutomatically\(next, generationAtStart\)/);
  assert.doesNotMatch(page, /className="canvas-core-action arrange-look-action"/);
});

test("Looks has its own primary navigation state and creates a new document", async () => {
  const html = await (await render("/looks")).text();
  assert.match(html, /aria-current="page"[^>]*>Looks<\/button>/);
  assert.doesNotMatch(html, /aria-current="page"[^>]*>Mi closet<\/button>/);
  assert.match(html, /Crear look/);
});

test("pricing sells only implemented product capabilities", async () => {
  const html = await (await render("/pricing")).text();
  assert.match(html, /Empieza gratis/);
  assert.match(html, /Cuando tu closet crece/);
  assert.match(html, /Un crédito se descuenta solo cuando la prenda queda lista/);
  assert.doesNotMatch(html, /planificación semanal|Asistente según|insights avanzados/);
});
