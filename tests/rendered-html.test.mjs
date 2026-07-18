import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("keeps the main product areas on stable routes", async () => {
  const routes = ["/about", "/closet", "/looks", "/pricing", "/perfil", "/ajustes", "/asistente"];
  const responses = await Promise.all(routes.map((route) => render(route)));
  for (const [index, response] of responses.entries()) {
    assert.equal(response.status, 200, `${routes[index]} should render`);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  }

  const about = await responses[0].text();
  const pricing = await responses[3].text();
  assert.match(about, /Vístete con lo que ya tienes/);
  assert.match(about, /Tu closet, por fin legible/);
  assert.match(pricing, /Un plan para cada closet/);

  const [pricingSource, publicProfileSource, closetSource, looksSource, profileSource] = await Promise.all([
    readFile(new URL("../app/pricing/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/[handle]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/closet/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/looks/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/perfil/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(pricingSource, /name: "Personal", monthlyPrice: 7\.99/);
  assert.match(pricingSource, /name: "Club", monthlyPrice: 12\.99/);
  assert.match(pricingSource, /El plan anual se cobra completo una vez al año/);
  assert.match(pricingSource, /Cobro único de US\$\{annualTotal\.toFixed\(2\)\} por todo el año/);
  assert.match(publicProfileSource, /className="public-profile-frame"/);
  assert.match(publicProfileSource, /Este perfil todavía no comparte prendas ni looks\./);
  assert.doesNotMatch(publicProfileSource, /join\(" · "\)/);
  assert.match(closetSource, /WardrobeApp initialRoute="closet"/);
  assert.match(looksSource, /WardrobeApp initialRoute="looks"/);
  assert.match(profileSource, /WardrobeApp initialRoute="perfil"/);
  assert.doesNotMatch(`${closetSource}${looksSource}${profileSource}`, /closetVariant/);
});

test("server-renders the FORMÉ wardrobe", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>FORMÉ — Tu closet visual<\/title>/i);
  assert.doesNotMatch(html, /CLOSET DE PRUEBA/);
  assert.match(html, /Vístete con lo que ya tienes/);
  assert.match(html, /CLOSET DIGITAL · ASISTENTE DE ESTILO/);
  assert.match(html, /EXPLORAR EL VESTIDOR/);
  assert.match(html, /ENTRAR Y SUBIR PRENDAS/);
  assert.match(html, /Juega con básicos Formé/);
  assert.match(html, /class="topbar-inner"/);
  assert.doesNotMatch(html, /＋ Agregar/);
  assert.match(html, /aria-label="Revisando sesión"/);
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
  assert.match(page, /function navigateWardrobeRoute/);
  assert.match(page, /sessionProfileStorageKey/);
  assert.match(page, /readCachedSessionProfile/);
  assert.match(page, /cacheSessionProfile/);
  assert.match(page, /clearCachedSessionProfile/);
  assert.match(page, /const cachedProfile = readCachedSessionProfile\(\)/);
  assert.match(page, /profileDraftFrom/);
  assert.match(page, /window\.history\.pushState/);
  assert.doesNotMatch(page, /sessionStatus === "checking" \? "ENTRANDO…"/);
  assert.match(page, /\/auth\/google\/start\?return_to=%2F/);
  assert.doesNotMatch(page, /signin-with-chatgpt/);
  assert.match(page, /aria-label="Entrar con Google"/);
  assert.match(auth, /AUTHORIZATION_ENDPOINT/);
  assert.match(auth, /TOKEN_ENDPOINT/);
  assert.match(auth, /USERINFO_ENDPOINT/);
  assert.match(auth, /__Host-forme_session/);
  assert.match(auth, /SameSite=Lax/);
  assert.match(auth, /crypto\.subtle\.verify/);
  assert.match(worker, /readNativeSession/);
  assert.match(worker, /async function getSession/);
  assert.match(worker, /if \(url\.pathname === "\/api\/session" && request\.method === "GET"\) return getSession\(request, env\)/);
  assert.doesNotMatch(page, /entry-gate/);
  assert.match(page, /Básicos Formé/);
  assert.match(page, /visiblePersonalGarments/);
  assert.match(page, /visibleFormeBasics/);
  assert.match(page, /＋ Agregar/);
  assert.match(page, /function buildDemoRecommendations/);
  assert.match(page, /footwear-white-sneakers/);
  assert.match(page, /accessory-black-sunglasses/);
  assert.match(page, /¿Qué necesitas hoy\?/);
  assert.match(page, /Casual/);
  assert.match(page, /Pulido/);
  assert.match(page, /Formal/);
  assert.match(page, /Experimental/);
  assert.match(page, /Día/);
  assert.match(page, /Noche/);
  assert.match(page, /Qué probar ahora/);
  assert.match(page, /Seguro/);
  assert.match(page, /Contraste/);
  assert.match(page, /Protagonista/);
  assert.match(page, /Esencial/);
  assert.match(page, /Capas/);
  assert.match(page, /function buildStylingRecommendations/);
  assert.match(page, /function garmentMatchesAudience/);
  assert.match(page, /function lookMatchesAudience/);
  assert.match(page, /pump\|high heel\|stiletto/);
  assert.match(page, /const strategies: StylingStrategy\[\] = \["balanced", "contrast", "statement", "minimal", "layered"\]/);
  assert.match(page, /excludedSignatures/);
  assert.match(page, /recommendationHistory/);
  assert.match(page, /function saveStylingRecommendation/);
  assert.match(page, /function generateLooksQuickly/);
  assert.match(page, /GENERAR LOOKS →/);
  assert.match(page, /GUARDAR COMO LOOK/);
  assert.match(page, /type StyleFamilyId = "classic"/);
  assert.match(page, /function StyleOnboarding/);
  assert.match(page, /SALTAR/);
  assert.match(page, /skipCalibration/);
  assert.match(page, /completed: true, ratings: \[\]/);
  assert.match(page, />EMPEZAR</);
  assert.match(page, /SIGUIENTE/);
  assert.match(page, /Queremos/);
  assert.match(page, /Formé lo irá afinando contigo/);
  assert.match(page, /\/api\/style-profile/);
  assert.match(page, /function stylePreferenceScore/);
  assert.match(page, /Básicos Formé/);
  assert.match(page, /studioPersonalGarments/);
  assert.match(page, /studioBasicGarments/);
  assert.doesNotMatch(page, /\["forme", "FORMÉ"\]/);
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
  assert.match(page, /const assistantPresets: AssistantPreset\[\]/);
  assert.match(page, /¿Qué me pongo hoy\?/);
  assert.match(page, /¿Qué uso esta semana\?/);
  assert.match(page, /Quiero usar más lo que tengo/);
  assert.match(page, /¿Qué falta en mi closet\?/);
  assert.match(page, /function buildAssistantAnswer/);
  assert.match(page, /function answerAssistantFollowup/);
  assert.match(page, /assistantProfileReady/);
  assert.match(page, /assistantClosetReady/);
  assert.match(page, /PUEDO SER MÁS PRECISO/);
  assert.match(page, /new Set\(assistantGarments\.map\(\(garment\) => garment\.category\)\)/);
  assert.match(page, /assistant-response-copy/);
  assert.match(page, /function openSavedLook\(look: SavedLook\)/);
  assert.match(page, /studioReturnPanel/);
  assert.match(page, /function openSavedLook[\s\S]*?openStudio\("looks"\)/);
  assert.match(page, /wardrobePanel === "looks"[\s\S]*?<WeeklyPlanView[\s\S]*?wardrobePanel === "assistant"/);
  assert.match(page, /className="week-strip-preview"/);
  assert.match(page, /timeZone: "America\/Lima"/);
  assert.match(page, /timeZone: "UTC"/);
  assert.match(page, /PLANEAR SEMANA/);
  assert.match(page, /REPLANTEAR SEMANA/);
  assert.match(page, /fetch\("\/api\/week", \{\s*method: "POST"/);
  assert.match(page, /function createLookFromWeek\(\)[\s\S]*?openStudio\("looks"\)/);
  assert.match(page, /function centeredLookPreviewItems/);
  assert.match(page, /function createInstagramStoryBlob/);
  assert.match(page, /navigator\.share/);
  assert.match(page, /COMPARTIR ↗/);
  assert.match(page, /Instagram Stories/);
  assert.match(page, /profile-drawer/);
  assert.match(page, /className="profile-page"/);
  assert.match(page, /profile-page-loading/);
  assert.match(page, /accountDataReady/);
  assert.doesNotMatch(page, /Tu closet, tus looks y la forma en que eliges vestirte\./);
  assert.match(page, /Lo que Formé entiende de ti/);
  assert.match(page, /GUARDAR CAMBIOS/);
  assert.match(page, /activeRoute === "perfil"/);
  assert.match(page, /REVISAR MI CALIBRACIÓN/);
  assert.match(page, /CUÁNTO QUIERES EXPERIMENTAR/);
  assert.match(page, /type="range"/);
  assert.match(page, /function saveExplorationPreference/);
  assert.match(page, /PERFIL PÚBLICO/);
  assert.match(page, /APARECER EN BÚSQUEDAS/);
  assert.match(page, /function saveAccountSettings/);
  assert.match(page, /function toggleOutfitVisibility/);
  assert.match(page, /profileTopStyles/);
  assert.doesNotMatch(page, />Perfil de estilo</i);
  assert.doesNotMatch(page, /profile-calibrate/);
  assert.doesNotMatch(page, /className="profile-identity"/);
  assert.doesNotMatch(page, /className="profile-stats"/);
  assert.doesNotMatch(page, /Mi colección/);
  assert.match(page, /className="wardrobe-tab-actions"/);
  assert.doesNotMatch(page, /closetVariant|isRetroCloset/);
  assert.match(page, /site-shell view-\$\{view\} forme-app/);
  assert.match(page, /className="closet-hero"/);
  assert.match(page, /ARCHIVO PERSONAL/);
  assert.doesNotMatch(page, /ABRIR VERSIÓN CLÁSICA/);
  assert.doesNotMatch(page, /routePath === "closet-v2"/);
  assert.match(page, /function autocompleteOptions/);
  assert.match(page, /garmentTypesByCategory/);
  assert.match(page, /Sweatshirt: "Polera"/);
  assert.match(page, /Jacket: "Casaca"/);
  assert.match(page, /const brandOptions = useMemo/);
  assert.match(page, /forme-brand-options/);
  assert.match(page, /forme-color-options/);
  assert.match(page, /forme-material-options/);
  assert.match(page, /normalizeGarmentMetadata/);
  assert.doesNotMatch(page, /className="catalog-toolbar"/);
  assert.match(page, /expanded-hitbox/);
  assert.match(page, /type TransformHandleSession/);
  assert.match(page, /function startTransformHandle/);
  assert.match(page, /className="transform-handle rotate-handle"/);
  assert.match(page, /className="transform-handle scale-handle"/);
  assert.doesNotMatch(page, /className="canvas-tools"/);
  assert.doesNotMatch(page, /ENVIAR ATRÁS/);
  assert.doesNotMatch(page, /aria-label="Reducir prenda"/);
  assert.match(page, /setActiveOutfitId\(outfitId\);\s+setActiveLookName\(lookName\);\s+setSaved\(true\)/);
  assert.match(page, /savingOutfit \|\| \(saved && selectedGroupIds\.length === 0\)/);
  assert.match(page, /function startMarqueeSelection/);
  assert.match(page, /snapshot-frame/);
  assert.match(page, /ÁREA DEL LOOK/);
  assert.match(page, /Empieza con una prenda\./);
  assert.doesNotMatch(page, /TU CANVAS ESTÁ VACÍO/);
  assert.doesNotMatch(page, /ESTO SE GUARDARÁ/);
  assert.match(page, /currentSnapshotItems/);
  assert.doesNotMatch(page, /Math\.random/);
  assert.match(page, /fetch\(`\/api\/outfits\/\$\{encodeURIComponent\(lookId\)\}`/);
  assert.doesNotMatch(page, /conjunto/i);
  assert.doesNotMatch(worker, /conjunto/i);
  assert.match(worker, /INSERT INTO outfit_items[\s\S]*?\.bind\(\s*crypto\.randomUUID\(\)/);
  assert.match(worker, /async function deleteOutfit/);
  assert.match(worker, /async function getWeeklyPlan/);
  assert.match(worker, /async function saveWeeklyPlanEntry/);
  assert.match(worker, /async function saveWeeklyPlan/);
  assert.match(worker, /request\.method === "POST"\) return saveWeeklyPlan/);
  assert.match(worker, /\/api\/week/);
  assert.match(worker, /accountProfileJson/);
  assert.match(worker, /async function getPublicProfile/);
  assert.match(worker, /async function publicMediaResponse/);
  assert.match(worker, /request\.method === "PUT" \|\| request\.method === "DELETE"/);
  assert.match(worker, /unique\.size !== 0 && unique\.size !== styleFamilies\.size/);
  assert.match(css, /\.saved-looks-grid/);
  assert.match(css, /\.forme-app \.closet-hero/);
  assert.match(css, /\.profile-drawer-backdrop/);
  assert.match(css, /\.profile-style-summary/);
  assert.match(css, /\.profile-page-hero/);
  assert.match(css, /\.profile-page-body/);
  assert.match(css, /\.profile-page-reading/);
  assert.match(css, /\.public-profile-page/);
  assert.match(css, /\.canvas-piece\.expanded-hitbox::before/);
  assert.match(css, /\.canvas-selection-box/);
  assert.match(css, /\.rotate-handle/);
  assert.match(css, /\.scale-handle/);
  assert.match(css, /\.share-status-message/);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.assistant-dialogue/);
  assert.match(css, /\.assistant-dialogue \{ padding:0; border:0; background:transparent/);
  assert.match(css, /\.assistant-data-readiness \{ padding:0; border:0; background:transparent/);
  assert.match(css, /\.assistant-question-flow/);
  assert.match(css, /\.assistant-response/);
  assert.match(css, /\.style-onboarding-backdrop/);
  assert.match(css, /\.style-family-card/);
  assert.match(css, /\.mix-canvas-navigator/);
  assert.match(css, /\.week-workspace/);
  assert.match(css, /\.week-strip-preview/);
  assert.match(css, /\.guest-entry-choices/);
  assert.doesNotMatch(page, /guest-welcome-flow/);
  assert.match(css, /\.insights-dashboard/);
  assert.match(css, /--canvas-greige:#d9d5cc/);
  assert.match(css, /padding:52px 16px calc\(150px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.pricing-page \.pricing-plan-list \{ grid-template-columns:1fr; gap:16px; \}/);
  assert.match(css, /\.pricing-page \.pricing-plan-list article > button \{ min-height:48px; margin-top:18px; \}/);
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
  assert.match(worker, /garment_type/);
  assert.match(worker, /\/api\/batches\/status/);
  assert.match(page, /function processingFileFor/);
  assert.match(page, /function whiteStudioCutout/);
  assert.match(page, /GENERAR DE NUEVO/);
  assert.match(page, /discountedBatchThreshold = 5/);
  assert.match(schema, /processingImageKey/);
  assert.match(schema, /generatedOpenImageKey/);
  assert.match(schema, /qaStatus/);
  assert.match(schema, /profilePublic/);
  assert.match(schema, /isPublic/);
  assert.match(schema, /garmentType/);
});
