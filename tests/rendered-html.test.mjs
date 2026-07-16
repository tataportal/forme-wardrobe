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
  assert.doesNotMatch(html, /CLOSET DE PRUEBA/);
  assert.match(html, />Mi closet</);
  assert.match(html, />Looks guardados</);
  assert.match(html, />Asistente</);
  assert.match(html, /＋ Agregar/);
  assert.match(html, /CONTINUAR CON GOOGLE|REVISANDO SESIÓN/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Codex is working/i);
});

test("keeps saved looks and styling recommendations connected to the product", async () => {
  const [page, worker, auth, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/wardrobe-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/google-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type WardrobePanel = "closet" \| "looks" \| "assistant"/);
  assert.match(page, /type ClosetMode = "browse" \| "upload"/);
  assert.match(page, /useState\(true\)/);
  assert.match(page, /useState\(formeBasics\)/);
  assert.match(page, /function beginGoogleSignIn/);
  assert.match(page, /\/auth\/google\/start\?return_to=%2F/);
  assert.doesNotMatch(page, /signin-with-chatgpt/);
  assert.match(page, /CONTINUAR CON GOOGLE/);
  assert.match(auth, /AUTHORIZATION_ENDPOINT/);
  assert.match(auth, /TOKEN_ENDPOINT/);
  assert.match(auth, /USERINFO_ENDPOINT/);
  assert.match(auth, /__Host-forme_session/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(worker, /readNativeSession/);
  assert.doesNotMatch(page, /entry-gate/);
  assert.match(page, /Básicos FORME/);
  assert.match(page, /visiblePersonalGarments/);
  assert.match(page, /visibleFormeBasics/);
  assert.match(page, /＋ Agregar/);
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
  assert.match(page, /Qué haría ahora/);
  assert.match(page, /Seguro/);
  assert.match(page, /Contraste/);
  assert.match(page, /Statement/);
  assert.match(page, /Esencial/);
  assert.match(page, /Capas/);
  assert.match(page, /function buildStylingRecommendations/);
  assert.match(page, /const strategies: StylingStrategy\[\] = \["balanced", "contrast", "statement", "minimal", "layered"\]/);
  assert.match(page, /excludedSignatures/);
  assert.match(page, /recommendationHistory/);
  assert.match(page, /function saveStylingRecommendation/);
  assert.match(page, /GUARDAR COMO LOOK/);
  assert.match(page, /type StyleFamilyId = "classic"/);
  assert.match(page, /function StyleOnboarding/);
  assert.match(page, /SALTAR INTRO/);
  assert.match(page, /EMPEZAR A ELEGIR/);
  assert.match(page, /SIGUIENTE FAMILIA/);
  assert.match(page, /Queremos/);
  assert.match(page, /Mira doce familias/);
  assert.match(page, /\/api\/style-profile/);
  assert.match(page, /function stylePreferenceScore/);
  assert.match(page, /BÁSICOS FORME/);
  assert.match(page, /studioPersonalGarments/);
  assert.match(page, /studioBasicGarments/);
  assert.doesNotMatch(page, /\["forme", "FORME"\]/);
  assert.match(page, /function buildLookIterations/);
  assert.match(page, /const iterationProfiles = \[/);
  assert.match(page, /MEZCLAR/);
  assert.match(page, /function openLookIteration/);
  assert.match(page, /function stepLookIteration/);
  assert.match(page, /className="mix-canvas-navigator"/);
  assert.match(page, /GUARDAR SELECCIÓN/);
  assert.match(page, /function duplicateCurrentOutfit/);
  assert.match(page, /function recommendationOuterPlacement/);
  assert.match(page, /function recommendationTopPlacement/);
  assert.match(page, /funnel-neck cape\|cape coat\|poncho/);
  assert.match(page, /\/puffer\//);
  assert.match(page, /function recommendStyle\(\)/);
  assert.match(page, /function openSavedLook\(look: SavedLook\)/);
  assert.match(page, /studioReturnPanel/);
  assert.match(page, /openStudio\(view === "studio" \? studioReturnPanel : wardrobePanel\)/);
  assert.match(page, /function centeredLookPreviewItems/);
  assert.match(page, /function createInstagramStoryBlob/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /COMPARTIR ↗/);
  assert.match(page, /Instagram Stories/);
  assert.match(page, /profile-drawer/);
  assert.match(page, /AJUSTAR PREFERENCIAS/);
  assert.match(page, /NIVEL DE EXPLORACIÓN/);
  assert.match(page, /profileTopStyles/);
  assert.doesNotMatch(page, />Perfil de estilo</i);
  assert.doesNotMatch(page, /profile-calibrate/);
  assert.doesNotMatch(page, /className="profile-identity"/);
  assert.doesNotMatch(page, /className="profile-stats"/);
  assert.doesNotMatch(page, /Mi colección/);
  assert.match(page, /className="wardrobe-tab-actions"/);
  assert.doesNotMatch(page, /className="catalog-toolbar"/);
  assert.match(page, /expanded-hitbox/);
  assert.match(page, /type TransformHandleSession/);
  assert.match(page, /function startTransformHandle/);
  assert.match(page, /className="transform-handle rotate-handle"/);
  assert.match(page, /className="transform-handle scale-handle"/);
  assert.match(page, /setActiveOutfitId\(outfitId\);\s+setActiveLookName\(lookName\);\s+setSaved\(true\)/);
  assert.match(page, /savingOutfit \|\| saved/);
  assert.doesNotMatch(page, /Math\.random/);
  assert.match(page, /fetch\(`\/api\/outfits\/\$\{encodeURIComponent\(lookId\)\}`/);
  assert.match(worker, /async function deleteOutfit/);
  assert.match(worker, /async function getWeeklyPlan/);
  assert.match(worker, /async function saveWeeklyPlanEntry/);
  assert.match(worker, /\/api\/week/);
  assert.match(worker, /isOwner: Boolean\(ownerEmail && identity\.email === ownerEmail\)/);
  assert.match(worker, /request\.method === "PUT" \|\| request\.method === "DELETE"/);
  assert.match(css, /\.saved-looks-grid/);
  assert.match(css, /\.profile-drawer-backdrop/);
  assert.match(css, /\.profile-style-summary/);
  assert.match(css, /\.canvas-piece\.expanded-hitbox::before/);
  assert.match(css, /\.canvas-selection-box/);
  assert.match(css, /\.rotate-handle/);
  assert.match(css, /\.scale-handle/);
  assert.match(css, /\.share-status-message/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.style-wheel/);
  assert.match(css, /\.style-onboarding-backdrop/);
  assert.match(css, /\.style-family-card/);
  assert.match(css, /\.mix-canvas-navigator/);
  assert.match(css, /\.week-workspace/);
  assert.match(css, /\.insights-dashboard/);
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
