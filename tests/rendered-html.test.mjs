import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FORME wardrobe", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FORME — Tu armario visual<\/title>/i);
  assert.match(html, /CLOSET DE PRUEBA/);
  assert.match(html, /Mis prendas/);
  assert.match(html, /Looks guardados/);
  assert.match(html, /Añadir mis prendas/);
  assert.match(html, /CONTINUAR CON GOOGLE|REVISANDO SESIÓN/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("keeps saved looks and styling recommendations connected to the product", async () => {
  const [page, worker, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/wardrobe-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type WardrobePanel = "pieces" \| "basics" \| "looks" \| "upload"/);
  assert.match(page, /useState\(true\)/);
  assert.match(page, /useState\(formeBasics\)/);
  assert.match(page, /function beginGoogleSignIn/);
  assert.match(page, /\/signin-with-chatgpt\?return_to=%2F/);
  assert.match(page, /CONTINUAR CON GOOGLE/);
  assert.doesNotMatch(page, /entry-gate/);
  assert.match(page, /Básicos FORME/);
  assert.match(page, /function buildDemoRecommendations/);
  assert.match(page, /footwear-white-sneakers/);
  assert.match(page, /accessory-black-sunglasses/);
  assert.match(page, /ASISTENTE DE STYLING/);
  assert.match(page, /Casual/);
  assert.match(page, /Smart/);
  assert.match(page, /Formal/);
  assert.match(page, /Experimental/);
  assert.match(page, /Día/);
  assert.match(page, /Noche/);
  assert.match(page, /ANÁLISIS COMPLETO/);
  assert.match(page, /Seguro/);
  assert.match(page, /Contraste/);
  assert.match(page, /Statement/);
  assert.match(page, /function buildStylingRecommendations/);
  assert.match(page, /function recommendationOuterPlacement/);
  assert.match(page, /function recommendationTopPlacement/);
  assert.match(page, /funnel-neck cape\|cape coat\|poncho/);
  assert.match(page, /\/puffer\//);
  assert.match(page, /function recommendStyle\(\)/);
  assert.match(page, /function openSavedLook\(look: SavedLook\)/);
  assert.doesNotMatch(page, /Math\.random/);
  assert.match(page, /fetch\(`\/api\/outfits\/\$\{encodeURIComponent\(lookId\)\}`/);
  assert.match(worker, /async function deleteOutfit/);
  assert.match(worker, /isOwner: Boolean\(ownerEmail && identity\.email === ownerEmail\)/);
  assert.match(worker, /request\.method === "PUT" \|\| request\.method === "DELETE"/);
  assert.match(css, /\.saved-looks-grid/);
  assert.match(css, /\.style-wheel/);
  assert.match(css, /--canvas-greige:#d9d5cc/);
});

test("keeps the garment pipeline economical, reversible, and cutout-first", async () => {
  const [page, worker, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/wardrobe-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(worker, /fallback: ImageQuality = "low"/);
  assert.match(worker, /endpoint: "\/v1\/images\/edits"/);
  assert.match(worker, /status = 'awaiting_cutout'/);
  assert.match(worker, /garment\.category === "Outerwear"/);
  assert.match(worker, /\/api\/batches\/status/);
  assert.match(page, /function processingFileFor/);
  assert.match(page, /function whiteStudioCutout/);
  assert.match(page, /REHACER EN MEDIUM/);
  assert.match(page, /discountedBatchThreshold = 5/);
  assert.match(schema, /processingImageKey/);
  assert.match(schema, /generatedOpenImageKey/);
  assert.match(schema, /qaStatus/);
});
