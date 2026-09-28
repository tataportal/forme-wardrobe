import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

// Execute the actual queue handler, SQL and PNG/alpha processing. Only the
// external provider, R2 transport and D1 transport are replaced locally.
const root = new URL("../", import.meta.url);
const bundle = await build({
  stdin: { contents: `
    export * from "./worker/wardrobe-api";
    export * from "./shared/garment-anatomy";
    export * from "./worker/contour-cutout";
    export * from "./worker/interior-edge-trace";
    export { slotPlacement, garmentLayout, ensureGarmentLayout } from "./app/garment-layout";
    export { default as encodePng, init as initPng } from "@jsquash/png/encode";
    export { default as decodePng } from "@jsquash/png/decode";
    export { default as pngWasm } from "@jsquash/png/codec/pkg/squoosh_png_bg.wasm";
  `, resolveDir: fileURLToPath(root), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent",
  loader: { ".wasm": "binary" },
  plugins: [{ name: "test-private-api", setup(builder) {
    builder.onLoad({ filter: /worker\/wardrobe-api\.ts$/ }, async ({ path }) => ({
      contents: `${await readFile(path, "utf8")}\nexport { garmentJson, saveGarment, finalizeGeneratedGarment, persistRecognizedMetadata, retryGarment };`, loader: "ts",
    }));
  } }],
});
const app = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
globalThis.ImageData ??= class ImageData { constructor(data, width, height) { Object.assign(this, { data, width, height }); } };
await app.initPng(app.pngWasm);
const migrations = await Promise.all((await readdir(new URL("drizzle/", root))).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFile(new URL(`drizzle/${name}`, root), "utf8")));

function database() {
  const sql = new DatabaseSync(":memory:");
  for (const migration of migrations) sql.exec(migration);
  const db = {
    prepare(query) {
      const statement = sql.prepare(query);
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        runSync() { const result = statement.run(...args); return { meta: { changes: Number(result.changes) } }; },
        async run() { return this.runSync(); },
      };
    },
    async batch(statements) {
      sql.exec("BEGIN");
      try { const results = statements.map(statement => statement.runSync()); sql.exec("COMMIT"); return results; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  sql.exec(`INSERT INTO users (id,email) VALUES ('owner','pipeline@forme.test');
    INSERT INTO garments (id,owner_id,client_id,name,category,color_family,tone,material,finish,silhouette,source_image_key)
    VALUES ('garment','owner','client','Upload','Tops','Black','Black','Textile','Matte','Regular','source.png');
    INSERT INTO processing_jobs (id,garment_id,owner_id,status) VALUES ('job','garment','owner','queued');`);
  return { sql, db, row: () => sql.prepare("SELECT * FROM garments WHERE id='garment'").get() };
}

function fixture(outerwear = false) {
  const width = 200, height = 250, data = new Uint8ClampedArray(width * height * 4).fill(255);
  const fill = (x1, y1, x2, y2) => {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) data.set([70, 65, 60, 255], (y * width + x) * 4);
  };
  fill(60, 50, 139, outerwear ? 219 : 139); // Body.
  fill(30, 50, 59, outerwear ? 219 : 179); fill(140, 50, 169, outerwear ? 219 : 179); // Sleeves.
  fill(80, 20, 119, 49); // High collar/hood.
  return { data, width, height };
}
function anatomy(outerwear = false) {
  return {
    region: "upper", body_length: outerwear ? "regular" : "cropped", neckline: "high", sleeve_length: "long", confidence: 96,
    left_shoulder: { x: 325, y: 200 }, right_shoulder: { x: 675, y: 200 },
    body_hem: { x: 350, y: outerwear ? 880 : 560 },
    left_cuff: { x: 225, y: outerwear ? 880 : 720 }, right_cuff: { x: 775, y: outerwear ? 880 : 720 },
  };
}
function anatomySelection(outerwear = false) {
  return { ...anatomy(outerwear), left_shoulder: "T325", right_shoulder: "T675", body_hem: "B350", left_cuff: "B225", right_cuff: "B775" };
}
const polygon = [{ x: 445, y: 280 }, { x: 555, y: 280 }, { x: 580, y: 450 }, { x: 565, y: 650 },
  { x: 555, y: 880 }, { x: 445, y: 880 }, { x: 435, y: 650 }, { x: 420, y: 450 }];

async function runPipeline(t, { outerwear = false, badFirst = false, badRetry = false, wrongLandmark = false, recognize = false } = {}) {
  const state = database();
  t.after(() => state.sql.close());
  if (outerwear) state.sql.exec("UPDATE garments SET category='Outerwear', garment_type='Jacket'");
  if (recognize) state.sql.exec("UPDATE garments SET category='', garment_type='', recognition_status='pending', metadata_status='pending'; UPDATE processing_jobs SET stage='recognize'");
  const input = fixture(outerwear);
  const png = await app.encodePng(input);
  const objects = new Map([["source.png", { bytes: png, httpMetadata: { contentType: "image/png" } }]]);
  const queued = [], requests = [];
  const env = {
    IMAGES: { input(stream) { return { transform(options) {
      assert.deepEqual(options, { width: 1024, height: 1280, fit: "contain" });
      return { async output(options) {
        assert.deepEqual(options, { format: "image/webp", quality: 92 });
        const png = await new Response(stream).arrayBuffer();
        return { response: () => new Response(png, { headers: { "content-type": "image/webp" } }) };
      } };
    } }; } },
    DB: state.db, OPENAI_API_KEY: "fake-provider-for-tests",
    GARMENT_JOBS: { async send(message) { queued.push(message); } },
    WARDROBE_MEDIA: {
      async get(key) { const value = objects.get(key); return value ? {
        httpMetadata: value.httpMetadata,
        async arrayBuffer() { return value.bytes; },
        async json() { return JSON.parse(new TextDecoder().decode(value.bytes)); },
      } : null; },
      async put(key, bytes, options) { objects.set(key, { bytes: typeof bytes === "string" ? new TextEncoder().encode(bytes).buffer : bytes, ...options }); },
      async delete(key) { objects.delete(key); },
    },
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/images/edits")) {
      requests.push("generate");
      assert.equal(options.body.get("model"), "gpt-image-2.5-sunburst");
      assert.equal(options.body.get("background"), "transparent");
      assert.equal(options.body.get("output_format"), "png");
      assert.equal(options.body.get("size"), "1024x1280");
      assert.equal(options.body.get("n"), "1");
      return Response.json({
        data: [{ b64_json: Buffer.from(png).toString("base64") }],
        usage: { input_tokens_details: { image_tokens: 1000, text_tokens: 200 }, output_tokens: 300 },
      });
    }
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), name = body.text.format.name;
    requests.push(name);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.store, false);
    const result = name === "garment_recognition" ? {
      supported: true, reason: "", name: "Prenda reconocida", description: "Cuello alto y mangas largas.",
      category: outerwear ? "Outerwear" : "Tops", garmentType: outerwear ? "Jacket" : "Sweater",
      brand: "", colorFamily: "Brown", tone: "Brown", material: "Textile", finish: "Matte", silhouette: "Regular",
      tags: ["manga larga"], frontOpening: outerwear, visualDetails: "High collar, long sleeves",
    } : name === "garment_anatomy" ? { ...anatomySelection(outerwear), confidence: badRetry ? 20 : 96 }
      : { passed: true, score: 98, summary: "Fiel", issues: [],
        anatomy: { ...anatomy(outerwear), confidence: badFirst ? 20 : 96,
          ...(wrongLandmark ? { body_hem: { x: 350, y: 400 } } : {}) },
        layering_mask: { applicable: outerwear, confidence: 99, points: outerwear ? polygon : [] } };
    return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify(result) }] }] });
  });
  queued.push({ ownerId: "owner", garmentId: "garment", jobId: "job", quality: "low", presentation: "auto", outputVariant: "closed", ...(recognize ? { stage: "recognize" } : {}) });
  let processed = 0;
  while (queued.length && processed++ < 6) {
    const body = queued.shift();
    let acked = false;
    await app.handleGarmentQueue({ messages: [{ body, attempts: 1, ack() { acked = true; }, retry() { throw new Error("Unexpected queue retry"); } }] }, env);
    assert.ok(acked);
  }
  assert.ok(processed < 6, "queue must be bounded");
  return { ...state, objects, requests, env, queued };
}

test("real queue -> PNG cutout -> D1 -> API -> Canvas persists torso, collar and sleeves", async t => {
  const state = await runPipeline(t);
  const row = state.row(), response = app.garmentJson(row);
  assert.equal(row.status, "ready", row.qa_notes);
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate"]);
  const job = state.sql.prepare("SELECT * FROM processing_jobs WHERE id='job'").get();
  assert.equal(job.image_model, "gpt-image-2.5-sunburst");
  assert.equal(job.image_input_tokens, 1000);
  assert.equal(job.text_input_tokens, 200);
  assert.equal(job.image_output_tokens, 300);
  assert.equal(job.generation_cost_microusd, 18000);
  const p = response.anatomy.closed;
  assert.equal(p.slots, 2);
  assert.equal(p.shoulderY, 0.2);
  assert.ok(Math.abs(p.bodyHeight - 0.36) < 1e-9);
  assert.ok(Math.abs(p.neckRise - 0.12) < 1e-9);
  assert.deepEqual(p.sleeveBottoms, [0.72, 0.72]);
  assert.equal(response.anatomy.open, null);
  const decoded = await app.decodePng(state.objects.get(row.image_key).bytes);
  assert.equal(decoded.width, 200); assert.equal(decoded.height, 250);
  assert.equal(decoded.data[3], 0);
  const before = app.slotPlacement(response);
  await app.saveGarment(state.db, "owner", "client", { ...response, name: "Long maxi coat with giant sleeves", tags: [] });
  const renamed = app.garmentJson(state.row());
  assert.deepEqual(renamed.anatomy, response.anatomy);
  assert.deepEqual(app.slotPlacement(renamed), before);
  assert.ok(!JSON.stringify(response.anatomy).includes("users/"), "API must not leak internal storage keys");
});

test("one approved master produces two cutouts with identical anatomical anchors", async t => {
  const state = await runPipeline(t, { outerwear: true });
  const row = state.row(), response = app.garmentJson(row);
  assert.equal(row.status, "ready", row.qa_notes);
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate", "layering_cutout_quality_gate"]);
  assert.deepEqual(response.anatomy.closed, response.anatomy.open);
  assert.notEqual(row.image_key, row.open_image_key);
  const closed = await app.decodePng(state.objects.get(row.image_key).bytes);
  const open = await app.decodePng(state.objects.get(row.open_image_key).bytes);
  assert.equal(closed.data[(125 * 200 + 100) * 4 + 3], 255);
  assert.equal(open.data[(125 * 200 + 100) * 4 + 3], 0);
  assert.equal(open.data[(30 * 200 + 100) * 4 + 3], 255, "back collar remains intact");
  assert.deepEqual(app.slotPlacement(response, "closed"), app.slotPlacement(response, "open"));
});

test("low-confidence anatomy retries measurement only, never generation", async t => {
  const state = await runPipeline(t, { badFirst: true });
  assert.equal(state.row().status, "ready");
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate", "garment_anatomy"]);
});

test("landmarks not on real alpha boundaries trigger measurement-only repair", async t => {
  const state = await runPipeline(t, { wrongLandmark: true });
  assert.equal(state.row().status, "ready");
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate", "garment_anatomy"]);
});

test("a white garment on real transparency is not erased as studio background", async () => {
  const input = fixture();
  for (let offset = 0; offset < input.data.length; offset += 4) {
    const garment = input.data[offset] !== 255;
    input.data.set(garment ? [250, 250, 248, 255] : [0, 0, 0, 0], offset);
  }
  const png = await app.encodePng(input);
  const result = await app.contourCutoutPng(new Uint8Array(png), [], anatomy());
  assert.equal(result.passed, true, result.notes);
  assert.ok(result.coverage > 0.1);
  assert.ok(result.layout);
});

test("two failed measurements stop automatically and retain the approved master", async t => {
  const state = await runPipeline(t, { badFirst: true, badRetry: true });
  assert.equal(state.row().status, "failed");
  assert.equal(state.row().layout_json, null);
  assert.ok(state.objects.has(state.row().generated_image_key));
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate", "garment_anatomy", "garment_anatomy"]);
});

test("mask repair waits for valid anatomy instead of failing the approved master", async t => {
  const state = await runPipeline(t, { outerwear: true, badFirst: true, badRetry: true });
  assert.equal(state.row().status, "failed");
  assert.ok(state.objects.has(state.row().generated_image_key));
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate", "garment_anatomy", "garment_anatomy"]);
  assert.ok(!state.requests.includes("layering_mask_repair"));
});

test("percentage confidence is explicit; 9 is never silently promoted to 90", () => {
  assert.match(app.anatomySchema.properties.confidence.description, /percentage.*90.*NOT 9/);
  assert.equal(app.parseVisualAnatomy({ ...anatomy(), confidence: 9 }), null);
  assert.equal(app.parseVisualAnatomy({ ...anatomy(), confidence: 0.9 }), null);
});

test("failed landmarks carry real whole-image alpha coordinates for remeasurement", () => {
  const input = fixture();
  // Use a transparent background, not the white master.
  for (let i = 0; i < input.data.length; i += 4) if (input.data[i] === 255) input.data[i + 3] = 0;
  assert.throws(() => app.measureCutoutAnatomy(input.data, input.width, input.height, { ...anatomy(), confidence: 9 }), error => {
    assert.ok(error instanceof app.InvalidAnatomyError);
    assert.match(error.contourGuide, /200x250/);
    assert.match(error.contourGuide, /"id":"B350","edge":"bottom","x":350,"y":560/);
    assert.match(error.contourGuide, /percentage 0\.\.100/);
    return true;
  });
});

test("candidate selection cannot invent, rescale or swap anatomical edge coordinates", () => {
  const input = fixture();
  for (let i = 0; i < input.data.length; i += 4) if (input.data[i] === 255) input.data[i + 3] = 0;
  const candidates = app.anatomyCandidates(input.data, input.width, input.height);
  const resolved = app.resolveAnatomySelection(anatomySelection(), candidates);
  assert.deepEqual(resolved.body_hem, { x: 350, y: 560 });
  assert.equal(app.measureCutoutAnatomy(input.data, input.width, input.height, resolved).hemY, 0.56);
  assert.throws(() => app.resolveAnatomySelection({ ...anatomySelection(), body_hem: { x: 350, y: 437 } }, candidates));
  assert.throws(() => app.resolveAnatomySelection({ ...anatomySelection(), body_hem: "T350" }, candidates));
});

test("interior refinement follows real panel edges and preserves the collar and hem", () => {
  const width = 200, height = 300, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 20; y <= 270; y++) for (let x = 30; x <= 170; x++) {
    const lining = x >= 90 && x <= 110 && y >= 60;
    const i = (y * width + x) * 4;
    data.set([lining ? 15 : 100, lining ? 15 : 100, lining ? 15 : 100, lining && y >= 260 ? 0 : 255], i);
  }
  const original = new Uint8ClampedArray(data);
  const proposal = Array.from({ length: 210 }, (_, i) => ({ y: 60 + i, start: 60, end: 140 }));
  const spans = app.traceInteriorEdges(data, width, height, proposal, { minX: 30, maxX: 170, minY: 20, maxY: 270 });
  assert.ok(spans?.length > 180);
  assert.ok(spans.every(s => s.start >= 90 && s.end <= 110 && s.y >= 60));
  assert.deepEqual(data, original, "tracing does not alter master pixels");
  for (let y = 260; y <= 270; y++) for (let x = 90; x <= 110; x++) data[(y * width + x) * 4 + 3] = 255;
  assert.equal(app.traceInteriorEdges(data, width, height, proposal, { minX: 30, maxX: 170, minY: 20, maxY: 270 }), null,
    "no invented hem gap when the image supplies none");
});

test("real retry endpoint resumes approved master once and never generates again", async t => {
  const state = await runPipeline(t, { badFirst: true, badRetry: true });
  const masterKey = state.row().generated_image_key;
  const before = state.requests.filter(name => name === "generate").length;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.text.format.name, "garment_anatomy");
    assert.match(body.input[0].content[0].text, /Actual silhouette candidates/);
    return Response.json({ output_text: JSON.stringify(anatomySelection()) });
  });
  const retry = () => app.retryGarment(new Request("https://forme.test/api/garments/client/retry", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quality: "medium" }),
  }),
    state.env, {}, state.db, { id: "owner" }, "client");
  const [first, repeated] = await Promise.all([retry(), retry()]);
  assert.equal(first.status, 202); assert.equal(repeated.status, 202);
  assert.equal(state.queued.length, 1);
  assert.equal(state.queued[0].stage, "postprocess");
  assert.equal(state.queued[0].generatedKey, masterKey);
  assert.equal(state.queued[0].quality, "low");
  assert.equal(state.sql.prepare("SELECT COUNT(*) AS count FROM processing_jobs").get().count, 1);
  state.sql.exec("UPDATE garments SET name='Nombre editado durante el calado', metadata_revision=1");
  await app.handleGarmentQueue({ messages: [{ body: state.queued.shift(), attempts: 1, ack() {}, retry() { throw new Error("Unexpected queue retry"); } }] }, state.env);
  assert.equal(state.row().status, "ready", state.row().qa_notes);
  assert.equal(state.row().generated_image_key, masterKey);
  assert.equal(state.row().name, "Nombre editado durante el calado");
  assert.equal(state.requests.filter(name => name === "generate").length, before);
});

test("retry cannot regenerate when the checkpoint master is missing or replaced", async t => {
  const state = await runPipeline(t, { badFirst: true, badRetry: true });
  state.objects.delete(state.row().generated_image_key);
  const response = await app.retryGarment(new Request("https://forme.test/api/garments/client/retry", { method: "POST" }),
    state.env, {}, state.db, { id: "owner" }, "client");
  assert.equal(response.status, 409);
  assert.equal(state.queued.length, 0);
  assert.equal(state.sql.prepare("SELECT COUNT(*) AS count FROM processing_jobs").get().count, 1);
});

test("old rows and externally replaced cutouts cannot expose stale geometry", async t => {
  const state = await runPipeline(t);
  const row = state.row();
  assert.equal(app.publicGarmentAnatomy(null, row.image_key, null), null);
  assert.equal(app.publicGarmentAnatomy(row.layout_json, "replacement.png", null), null);
  assert.equal(app.publicGarmentAnatomy("invalid", row.image_key, null), null);
  assert.equal(app.parseVisualAnatomy({ ...anatomy(), body_length: "boot" }), null);
  assert.equal(app.parseVisualAnatomy({ ...anatomy(), left_cuff: null }), null);
});

test("a postprocessing retry reuses persisted approval instead of repeating image QA", async t => {
  const state = await runPipeline(t);
  const row = state.row();
  const master = state.objects.get(row.generated_image_key).bytes;
  await app.finalizeGeneratedGarment(state.env, state.db, row, "job", "low", "auto", "closed", row.generated_image_key,
    new Uint8Array(master), master, "image/png");
  assert.deepEqual(state.requests, ["generate", "garment_quality_gate"]);
  assert.equal(state.row().status, "ready");
});

test("even a failed subsequent mask review cannot regenerate an approved master", async t => {
  const state = await runPipeline(t, { outerwear: true });
  const row = state.row(), master = state.objects.get(row.generated_image_key).bytes;
  t.mock.method(globalThis, "fetch", async url => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    return Response.json({ output_text: JSON.stringify({ passed: false, score: 40, summary: "Máscara incierta", issues: [], layering_mask: { applicable: false, confidence: 0, points: [] } }) });
  });
  await app.finalizeGeneratedGarment(state.env, state.db, row, "job", "low", "auto", "closed", row.generated_image_key,
    new Uint8Array(master), master, "image/png", 1);
  assert.equal(state.row().status, "failed");
  assert.ok(state.objects.has(row.generated_image_key));
  assert.equal(state.requests.filter(name => name === "generate").length, 1);
});

test("mask-only repair preserves approved fidelity and anatomical measurements", async t => {
  const state = await runPipeline(t, { outerwear: true });
  const row = state.row(), master = state.objects.get(row.generated_image_key).bytes;
  const priorLayout = JSON.parse(row.layout_json).closed.measurement;
  const repairs = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body), name = body.text.format.name;
    repairs.push(name);
    if (name === "layering_mask_repair") {
      assert.equal(body.input[0].content.filter(part => part.type === "input_image").length, 3);
      return Response.json({ output_text: JSON.stringify({ confidence: 96, sections: Array.from({ length: 12 }, () => ({ left_x: 445, right_x: 555 })) }) });
    }
    assert.equal(name, "layering_cutout_quality_gate");
    return Response.json({ output_text: JSON.stringify({ passed: true, score: 96, summary: "Bordes conservados", issues: [] }) });
  });
  await app.finalizeGeneratedGarment(state.env, state.db, row, "job", "low", "auto", "closed", row.generated_image_key,
    new Uint8Array(master), master, "image/png", 1);
  assert.equal(state.row().status, "ready", state.row().qa_notes);
  assert.equal(state.row().generated_image_key, row.generated_image_key);
  const result = JSON.parse(state.row().layout_json).closed.measurement;
  assert.deepEqual({ ...result, measuredAt: null }, { ...priorLayout, measuredAt: null });
  assert.deepEqual(repairs, ["layering_mask_repair", "layering_cutout_quality_gate"]);
});

test("interrupted postprocess releases its lease and retries immediately without regenerating", async t => {
  const state = await runPipeline(t, { outerwear: true });
  const key = state.row().generated_image_key;
  state.sql.exec("UPDATE processing_jobs SET status='queued'; UPDATE garments SET status='processing'");
  t.mock.method(globalThis, "fetch", async () => { throw new DOMException("Timed out", "TimeoutError"); });
  const payload = { ownerId: "owner", garmentId: "garment", jobId: "job", quality: "low", presentation: "auto", outputVariant: "closed", stage: "postprocess", generatedKey: key, maskAttempt: 1 };
  let delay;
  await app.handleGarmentQueue({ messages: [{ body: payload, attempts: 1, ack() { throw new Error("Should retry"); }, retry(options) { delay = options.delaySeconds; } }] }, state.env);
  const job = state.sql.prepare("SELECT * FROM processing_jobs WHERE id='job'").get();
  assert.equal(job.status, "queued");
  assert.equal(delay, 10);
  assert.equal(job.generated_key, key);
  assert.match(job.error, /interrumpió la corrección/);
  assert.ok(state.objects.has(key));
});

test("duplicate delivery cannot release another invocation's active lease", async t => {
  const state = await runPipeline(t);
  state.sql.exec("UPDATE processing_jobs SET status='processing',updated_at=CURRENT_TIMESTAMP");
  let delay;
  await app.handleGarmentQueue({ messages: [{ body: { ownerId: "owner", garmentId: "garment", jobId: "job", quality: "low", presentation: "auto", outputVariant: "closed", stage: "postprocess", generatedKey: state.row().generated_image_key }, attempts: 1,
    ack() { throw new Error("Should wait"); }, retry(options) { delay = options.delaySeconds; } }] }, state.env);
  assert.equal(state.sql.prepare("SELECT status FROM processing_jobs WHERE id='job'").get().status, "processing");
  assert.equal(delay, 60);
});

for (const outerwear of [false, true]) test(`new recognition -> generation -> QA -> ${outerwear ? 2 : 1} real PNG cutout(s) -> anatomy`, async t => {
  const state = await runPipeline(t, { recognize: true, outerwear });
  const result = app.garmentJson(state.row());
  assert.equal(result.status, "ready", result.qaNotes);
  assert.equal(result.metadataStatus, "ready");
  assert.equal(result.name, "Prenda reconocida");
  assert.equal(result.description, "Cuello alto y mangas largas.");
  assert.equal(Boolean(result.openImage), outerwear);
  assert.ok(result.anatomy.closed);
  assert.deepEqual(state.requests, ["garment_recognition", "generate", "garment_quality_gate", ...(outerwear ? ["layering_cutout_quality_gate"] : [])]);
});

test("a display-length correction survives metadata edits and postprocessing; auto restores detection", async t => {
  const state = await runPipeline(t);
  const detected = app.garmentJson(state.row());
  const original = app.slotPlacement(detected);
  await app.saveGarment(state.db, "owner", "client", { ...detected, lengthOverride: "hip", tags: [] });
  const corrected = app.garmentJson(state.row());
  assert.equal(corrected.lengthOverride, "hip");
  assert.equal(app.garmentLayout(corrected).slots, 3.5);
  assert.deepEqual(corrected.anatomy, detected.anatomy, "a display correction never rewrites measured landmarks");
  assert.notDeepEqual(app.slotPlacement(corrected), original);
  const { lengthOverride, ...favoriteEdit } = corrected;
  await app.saveGarment(state.db, "owner", "client", { ...favoriteEdit, favorite: true, tags: [] });
  assert.equal(app.garmentJson(state.row()).lengthOverride, "hip", "older clients omitting the field preserve it");
  const row = state.row();
  await app.finalizeGeneratedGarment(state.env, state.db, row, "job", "low", "auto", "closed", row.generated_image_key,
    new Uint8Array(state.objects.get(row.generated_image_key).bytes), state.objects.get("source.png").bytes, "image/png");
  assert.equal(app.garmentJson(state.row()).lengthOverride, "hip");
  assert.equal(state.requests.filter(request => request === "generate").length, 1);
  await app.saveGarment(state.db, "owner", "client", { ...corrected, lengthOverride: null, tags: [] });
  assert.deepEqual(app.slotPlacement(app.garmentJson(state.row())), original);
});

test("both cutouts share the explicit length correction and new output storage is WebP", async t => {
  const state = await runPipeline(t, { outerwear: true });
  const item = app.garmentJson(state.row());
  await app.saveGarment(state.db, "owner", "client", { ...item, lengthOverride: "cropped", tags: [] });
  const corrected = app.garmentJson(state.row());
  assert.equal(app.garmentLayout(corrected, "closed").slots, 2);
  assert.deepEqual(app.slotPlacement(corrected, "closed"), app.slotPlacement(corrected, "open"));
  for (const key of [state.row().image_key, state.row().open_image_key]) {
    assert.ok(key.endsWith(".webp"));
    assert.equal(state.objects.get(key).httpMetadata.contentType, "image/webp");
  }
});
