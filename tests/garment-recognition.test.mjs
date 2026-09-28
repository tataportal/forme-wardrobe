import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const bundle = await build({
  stdin: { contents: `export * from "./worker/wardrobe-api"; export * from "./worker/garment-recognition";`, resolveDir: fileURLToPath(root), loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent", loader: { ".wasm": "binary" },
});
const app = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const migrations = await Promise.all((await readdir(new URL("drizzle/", root))).filter(name => name.endsWith(".sql")).sort()
  .map(name => readFile(new URL(`drizzle/${name}`, root), "utf8")));
const recognized = (open = false) => ({
  supported: true, reason: "", name: open ? "Casaca negra" : "Camiseta blanca", description: "Prenda lisa de textura suave.",
  category: open ? "Outerwear" : "Tops", garmentType: open ? "Jacket" : "T-shirt", brand: "", colorFamily: "White",
  tone: "White", material: "Textile", finish: "Matte", silhouette: "Regular", tags: ["liso", "casual"],
  frontOpening: open, visualDetails: open ? "Full front zipper; standing collar" : "Crew neck; short sleeves",
});

async function harness(t, result = recognized()) {
  const sql = new DatabaseSync(":memory:");
  t.after(() => sql.close());
  migrations.forEach(migration => sql.exec(migration));
  let failMetadata = false, failGeneration = false, batchStatus = "validating";
  const db = {
    prepare(query) {
      const statement = sql.prepare(query); let args = [];
      return {
        query,
        bind(...values) { args = values; return this; },
        async first() { return statement.get(...args) ?? null; },
        async all() { return { results: statement.all(...args) }; },
        runSync() { return { meta: { changes: Number(statement.run(...args).changes) } }; },
        async run() { return this.runSync(); },
      };
    },
    async batch(statements) {
      if (failMetadata && statements.some(statement => statement.query.includes("SET name = ?, description = ?"))) throw new Error("Metadata transport failure");
      sql.exec("BEGIN");
      try { const result = statements.map(statement => statement.runSync()); sql.exec("COMMIT"); return result; }
      catch (error) { sql.exec("ROLLBACK"); throw error; }
    },
  };
  const objects = new Map(), queued = [], calls = [], prompts = [];
  const env = {
    DB: db, OPENAI_API_KEY: "mock-provider-only", GARMENT_JOBS: { async send(message) { queued.push(message); } },
    WARDROBE_MEDIA: {
      async put(key, body, options) {
        const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body instanceof ReadableStream ? new Uint8Array(await new Response(body).arrayBuffer()) : body;
        objects.set(key, { bytes, ...options });
      },
      async get(key) { const value = objects.get(key); return value ? {
        ...value, async arrayBuffer() { return value.bytes; }, async json() { return JSON.parse(new TextDecoder().decode(value.bytes)); },
      } : null; },
      async delete(key) { objects.delete(key); },
    },
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/responses")) {
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.input[0].content.filter(item => item.type === "input_image").length, 1);
      if (body.text.format.name === "canvas_placement") {
        assert.equal(body.model, "gpt-5.6-luna");
        assert.equal(body.reasoning.effort, "low");
        const instanceId = body.text.format.schema.properties.items.items.properties.instanceId.enum[0];
        calls.push("canvas-placement");
        return Response.json({
          output_text: JSON.stringify({ items: [{ instanceId, x: 50, y: 41, scale: .52, layer: 1, confidence: 93 }] }),
          usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 100 },
        });
      }
      assert.equal(body.text.format.name, "garment_recognition");
      assert.ok(!JSON.stringify(body).includes("WRONG_FILENAME"));
      calls.push("recognize");
      return Response.json({ output_text: JSON.stringify(result) }, { headers: { "x-request-id": "recognition-request" } });
    }
    if (url.endsWith("/images/edits")) {
      calls.push("generate"); prompts.push(options.body.get("prompt"));
      assert.ok(options.body.get("image[]") instanceof File);
      assert.equal(options.body.get("model"), "gpt-image-2.5-sunburst");
      assert.equal(options.body.get("background"), "transparent");
      assert.equal(options.body.get("output_format"), "png");
      if (failGeneration) return Response.json({ error: { message: "Provider unavailable" } }, { status: 503 });
      return Response.json({
        data: [{ b64_json: Buffer.from("master").toString("base64") }],
        usage: { input_tokens_details: { image_tokens: 1000, text_tokens: 200 }, output_tokens: 300 },
      });
    }
    if (url.endsWith("/files")) {
      const file = options.body.get("file");
      if (file.type === "application/jsonl") prompts.push((await file.text()).split("\n").map(line => JSON.parse(line).body.prompt).join("\n"));
      calls.push("file"); return Response.json({ id: `file-${calls.length}` });
    }
    if (url.endsWith("/batches")) { calls.push("batch"); return Response.json({ id: "batch-test", status: "validating" }); }
    if (url.endsWith("/batches/batch-test")) return Response.json({
      id: "batch-test",
      status: batchStatus,
      input_file_id: "batch-input-file",
      output_file_id: batchStatus === "completed" ? "batch-output-file" : null,
    });
    if (url.endsWith("/files/batch-output-file/content")) {
      const jobs = sql.prepare("SELECT id FROM processing_jobs WHERE batch_id = 'batch-test' AND status = 'batch_processing'").all();
      const output = jobs.map(job => JSON.stringify({
        custom_id: job.id,
        response: {
          status_code: 200,
          body: {
            data: [{ b64_json: Buffer.from("batch-master").toString("base64") }],
            usage: { input_tokens_details: { image_tokens: 1000, text_tokens: 200 }, output_tokens: 300 },
          },
        },
      })).join("\n");
      return new Response(output);
    }
    if (options?.method === "DELETE" && url.includes("/files/")) return Response.json({ deleted: true });
    throw new Error(`Unexpected provider call: ${url}`);
  });
  const api = async (path, options = {}) => {
    const response = await app.handleWardrobeApi(new Request(`http://localhost${path}`, options), env, { waitUntil() {} });
    assert.ok(response); return { status: response.status, body: await response.json() };
  };
  const upload = async (mode = "immediate") => {
    const intake = crypto.randomUUID(), item = crypto.randomUUID();
    const batch = await api("/api/intake-batches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: intake,
      items: [{ clientItemId: item, filename: "WRONG_FILENAME-jacket.png", fingerprint: item }] }) });
    assert.equal(batch.status, 201);
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "WRONG_FILENAME-jacket.png", { type: "image/png" }));
    form.append("intakeBatchId", intake); form.append("intakeItemId", item); form.append("processingMode", mode);
    form.append("name", "WRONG_FILENAME"); form.append("category", "Outerwear"); form.append("garmentType", "Jacket");
    const response = await api("/api/upload", { method: "POST", body: form });
    assert.equal(response.status, 202, JSON.stringify(response.body));
    return response.body.garment.id;
  };
  const deliver = async (body, attempts = 1) => {
    let ack = false, retry = false;
    await app.handleGarmentQueue({ messages: [{ body, attempts, ack() { ack = true; }, retry() { retry = true; } }] }, env);
    return { ack, retry };
  };
  const row = id => sql.prepare("SELECT * FROM garments WHERE client_id = ?").get(id);
  return {
    sql, env, queued, calls, prompts, api, upload, deliver, row,
    failMetadata(value) { failMetadata = value; },
    failGeneration(value) { failGeneration = value; },
    setBatchStatus(value) { batchStatus = value; },
  };
}

test("Canvas placement uses the garment image, structured output and exact model cost", async t => {
  const h = await harness(t), garmentId = await h.upload();
  h.sql.prepare("UPDATE garments SET image_key = source_image_key, status = 'ready' WHERE client_id = ?").run(garmentId);
  const response = await h.api("/api/canvas-placement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ instanceId: "piece-1", garmentId, variant: "closed", name: "Casaca", category: "Outerwear", garmentType: "Jacket" }] }),
  });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.deepEqual(response.body.placements, [{ instanceId: "piece-1", x: 50, y: 41, scale: .52, z: 1, confidence: 93 }]);
  assert.equal(response.body.model, "gpt-5.6-luna");
  assert.equal(response.body.costUsd, .000284);
  assert.deepEqual(h.calls, ["canvas-placement"]);
  assert.equal(app.canvasPlacementCostUsd("gpt-5.6-luna", { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 100 }), .000284);
  assert.equal(app.textModelCostMicrousd("gpt-5.6-luna", { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 100 }), 284);
  const usage = h.sql.prepare("SELECT operation, cost_microusd FROM ai_usage_events").get();
  assert.deepEqual({ ...usage }, { operation: "canvas_placement", cost_microusd: 284 });
});

test("pricing activation captures a deduplicated commercial lead without login", async t => {
  const h = await harness(t);
  const request = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
    name: "Tata", email: "TATA@example.com", planId: "personal", billingCycle: "annual", company: "",
  }) };
  assert.equal((await h.api("/api/sales-interest", request)).status, 201);
  assert.equal((await h.api("/api/sales-interest", { ...request, body: JSON.stringify({
    name: "Tata Portal", email: "tata@example.com", planId: "personal", billingCycle: "annual", company: "",
  }) })).status, 201);
  const lead = h.sql.prepare("SELECT email, name, plan_id, billing_cycle, status FROM sales_leads").get();
  assert.deepEqual({ ...lead }, { email: "tata@example.com", name: "Tata Portal", plan_id: "personal", billing_cycle: "annual", status: "new" });
  assert.equal(h.sql.prepare("SELECT COUNT(*) AS count FROM sales_leads").get().count, 1);
});

test("public mutations reject cross-site requests and rate-limited actors", async t => {
  const h = await harness(t);
  const body = JSON.stringify({ name: "Bot", email: "bot@example.com", planId: "personal", billingCycle: "monthly", company: "" });
  const crossSite = await h.api("/api/sales-interest", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body,
  });
  assert.equal(crossSite.status, 403);
  h.env.PUBLIC_RATE_LIMITER = { async limit() { return { success: false }; } };
  const limited = await h.api("/api/sales-interest", { method: "POST", headers: { "content-type": "application/json" }, body });
  assert.equal(limited.status, 429);
  assert.equal(h.sql.prepare("SELECT COUNT(*) AS count FROM sales_leads").get().count, 0);
});

test("the backend enforces the 15-photo batch limit", async t => {
  const h = await harness(t);
  const items = Array.from({ length: 16 }, (_, index) => ({ clientItemId: `item-${index}`, filename: `${index}.png`, fingerprint: `fingerprint-${index}` }));
  const response = await h.api("/api/intake-batches", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId: "oversized-batch", items }),
  });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /hasta 15 fotos/);
});

test("upload -> one visual analysis -> independent data and image messages", async t => {
  const h = await harness(t), id = await h.upload();
  assert.equal(h.row(id).category, "");
  assert.equal(h.queued[0].stage, "recognize");
  assert.equal((await h.deliver(h.queued.shift())).ack, true);
  assert.deepEqual(h.calls, ["recognize"]);
  assert.deepEqual(h.queued.map(item => item.stage).sort(), ["generate", "metadata"]);
  const record = JSON.parse(h.row(id).recognition_json);
  assert.equal(record.result.category, "Tops");
  assert.equal(record.sourceSha256.length, 64);
  assert.equal(record.requestId, "recognition-request");
  assert.ok(record.prompt.length < 1700);
  assert.match(record.prompt, /Preserve the natural closed construction/);
  assert.doesNotMatch(record.prompt, /WRONG_FILENAME|OPEN STATE REQUIRED/);
  await h.deliver(h.queued.find(item => item.stage === "metadata"));
  const status = await h.api(`/api/garments/${id}/status`);
  assert.equal(status.body.garment.description, recognized().description);
  assert.deepEqual(status.body.garment.tags, ["casual", "liso"]);
  assert.equal(status.body.garment.category, "Tops");
  assert.deepEqual(h.calls, ["recognize"], "data is editable before generation starts");
  assert.ok(!JSON.stringify(status.body.garment).includes("sourceSha256"));
});

test("metadata failure does not block image generation; replay cannot overwrite user edits", async t => {
  const h = await harness(t), id = await h.upload();
  await h.deliver(h.queued.shift());
  const metadata = h.queued.find(item => item.stage === "metadata"), generation = h.queued.find(item => item.stage === "generate");
  h.failMetadata(true);
  assert.equal((await h.deliver(metadata)).retry, true);
  await h.deliver(generation);
  assert.deepEqual(h.calls, ["recognize", "generate"]);
  assert.ok(h.row(id).generated_image_key);
  h.failMetadata(false);
  await h.deliver(metadata);
  const original = (await h.api(`/api/garments/${id}/status`)).body.garment;
  const saved = await h.api(`/api/garments/${id}`, { method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...original, name: "Mi nombre editado", description: "Mi descripción", tags: ["mío"] }) });
  assert.equal(saved.status, 200);
  await h.deliver(metadata);
  assert.equal(h.row(id).name, "Mi nombre editado");
  assert.equal(h.row(id).description, "Mi descripción");
  assert.equal((await h.api(`/api/garments/${id}/status`)).body.garment.tags[0], "mío");
  assert.equal(h.calls.filter(call => call === "recognize").length, 1);
});

test("generation retries reuse recognition and frozen prompt without rewriting metadata", async t => {
  const h = await harness(t, recognized(true)), id = await h.upload();
  await h.deliver(h.queued.shift());
  await h.deliver(h.queued.find(item => item.stage === "metadata"));
  h.failGeneration(true);
  await h.deliver(h.queued.find(item => item.stage === "generate"), 6);
  assert.equal(h.row(id).status, "failed");
  h.failGeneration(false);
  h.queued.length = 0;
  const response = await h.api(`/api/garments/${id}/retry`, { method: "POST" });
  assert.equal(response.status, 202);
  await h.deliver(h.queued.shift());
  assert.deepEqual(h.calls, ["recognize", "generate", "generate"]);
  assert.equal(h.prompts[0], h.prompts[1]);
  assert.match(h.prompts[0], /Unfasten only the existing full front closure/);
});

test("batch recognition is immediate and batch generation uses the same cached prompt", async t => {
  const h = await harness(t), first = await h.upload("batch"), second = await h.upload("batch");
  const request = () => h.api("/api/batches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ garmentIds: [first, second] }) });
  assert.equal((await request()).body.recognizing, true);
  assert.deepEqual(h.calls, []);
  await h.deliver(h.queued.shift()); await h.deliver(h.queued.shift());
  assert.deepEqual(h.calls, ["recognize", "recognize"]);
  assert.ok(h.queued.every(item => ["metadata", "batch"].includes(item.stage)));
  assert.equal((await request()).body.batch.id, "batch-test");
  assert.ok(h.prompts[0].includes(JSON.parse(h.row(first).recognition_json).prompt));
  assert.equal(h.row(first).status, "batch_processing");
  const count = h.calls.length;
  assert.equal((await request()).body.batch.id, "batch-test");
  assert.equal(h.calls.length, count, "replaying batch submission must not buy more images");
});

test("the batch controller reconciles provider output without an open browser", async t => {
  const h = await harness(t), first = await h.upload("batch"), second = await h.upload("batch");
  await h.deliver(h.queued.shift());
  await h.deliver(h.queued.shift());
  const response = await h.api("/api/batches", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ garmentIds: [first, second] }),
  });
  assert.equal(response.body.batch.id, "batch-test");
  const monitor = h.queued.find(message => message.stage === "batch_monitor");
  assert.equal(monitor.batchId, "batch-test");

  const pending = await h.deliver(monitor);
  assert.equal(pending.ack, true);
  assert.equal(pending.retry, false);
  const nextMonitor = h.queued.filter(message => message.stage === "batch_monitor").at(-1);
  assert.notEqual(nextMonitor, monitor, "a pending provider batch schedules a fresh monitor without exhausting queue retries");

  h.setBatchStatus("completed");
  await h.deliver(nextMonitor);
  assert.ok(h.row(first).generated_image_key);
  assert.ok(h.row(second).generated_image_key);
  assert.equal(h.sql.prepare("SELECT COUNT(*) AS count FROM processing_jobs WHERE batch_id = 'batch-test' AND stage = 'postprocess' AND status = 'queued'").get().count, 2);
  assert.equal(h.queued.filter(message => message.stage === "postprocess").length, 2);
});

test("unrecognizable photos fail before spending on generation", async t => {
  const h = await harness(t, { ...recognized(), supported: false, reason: "No se distingue una sola prenda." }), id = await h.upload();
  await h.deliver(h.queued.shift());
  assert.equal(h.row(id).status, "failed");
  assert.equal(h.row(id).recognition_status, "failed");
  assert.deepEqual(h.calls, ["recognize"]);
  assert.equal(h.queued.length, 0);
});

test("retry during batch submission reuses the active job instead of buying a second image", async t => {
  const h = await harness(t), first = await h.upload("batch"), second = await h.upload("batch");
  await h.deliver(h.queued.shift());
  await h.deliver(h.queued.shift());
  const providerFetch = globalThis.fetch;
  let retry;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/files") && !retry) {
      retry = await h.api(`/api/garments/${first}/retry`, { method: "POST" });
    }
    return providerFetch(url, options);
  });
  const response = await h.api("/api/batches", { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ garmentIds: [first, second] }) });
  assert.equal(response.body.batch.id, "batch-test");
  assert.equal(retry.status, 202);
  assert.equal(retry.body.job.status, "batch_submitting");
  assert.equal(h.sql.prepare("SELECT COUNT(*) AS count FROM processing_jobs WHERE garment_id = ?").get(h.row(first).id).count, 1);
  assert.ok(h.queued.every(message => message.stage !== undefined && message.stage !== "generate"));
});

test("invalid taxonomy is rejected and non-upper clothing can never get an invented opening", () => {
  assert.throws(() => app.parseRecognition({ ...recognized(), category: "Bottoms" }));
  assert.equal(app.parseRecognition({ ...recognized(), category: "Bottoms", garmentType: "Jeans", frontOpening: true }).frontOpening, false);
});

test("duplicate recognition and generation deliveries cannot regenerate an existing master", async t => {
  const h = await harness(t), id = await h.upload();
  const recognition = h.queued.shift();
  await h.deliver(recognition);
  const generation = h.queued.find(item => item.stage === "generate");
  await h.deliver(recognition, 2);
  await h.deliver(generation);
  const key = h.row(id).generated_image_key;
  await h.deliver(generation, 2);
  assert.deepEqual(h.calls, ["recognize", "generate"]);
  assert.equal(h.row(id).generated_image_key, key);
});

test("metadata still succeeds when generation fails and does not get overwritten by its retry", async t => {
  const h = await harness(t), id = await h.upload();
  await h.deliver(h.queued.shift());
  const metadata = h.queued.find(item => item.stage === "metadata");
  const originalFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, options) => url.endsWith("/images/edits")
    ? Response.json({ error: { message: "Temporarily unavailable" } }, { status: 503 }) : originalFetch(url, options));
  assert.equal((await h.deliver(h.queued.find(item => item.stage === "generate"))).retry, true);
  await h.deliver(metadata);
  assert.equal(h.row(id).metadata_status, "ready");
  assert.equal(h.row(id).description, recognized().description);
  assert.equal(h.row(id).recognition_status, "ready");
});

test("a staged upload continues from the backend even after the browser leaves", async t => {
  const h = await harness(t), id = await h.upload("batch");
  await h.deliver(h.queued.shift());
  const batch = h.queued.find(item => item.stage === "batch");
  assert.ok(batch);
  await h.deliver(batch);
  // One remaining garment uses the immediate path instead of getting stranded.
  const generation = h.queued.find(item => item.stage === undefined || item.stage === "generate");
  assert.ok(generation);
  await h.deliver(generation);
  assert.ok(h.row(id).generated_image_key);
  assert.equal(h.calls.filter(call => call === "recognize").length, 1);
});

test("recognition supports one-piece clothing and stable belt/scarf types", () => {
  for (const [category, garmentType] of [["One-pieces", "Dress"], ["One-pieces", "Jumpsuit"], ["One-pieces", "Overalls"], ["Accessories", "Belt"], ["Accessories", "Scarf"]]) {
    const item = app.parseRecognition({ ...recognized(), category, garmentType, frontOpening: true });
    assert.equal(item.garmentType, garmentType);
    assert.equal(item.frontOpening, false);
    assert.ok(app.recognitionPrompt(item).includes("REFERENCE DATA"));
  }
});

test("API rejects physical sizes and incompatible display lengths without corrupting the garment", async t => {
  const h = await harness(t);
  const id = await h.upload();
  await h.deliver(h.queued.shift());
  await h.deliver(h.queued.find(message => message.stage === "metadata"));
  for (const lengthOverride of ["XL", "42 cm", "boot"]) {
    const result = await h.api(`/api/garments/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...recognized(), lengthOverride }) });
    assert.equal(result.status, 400);
  }
  assert.equal(h.row(id).length_override, null);
});
