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
  let failMetadata = false, failGeneration = false;
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
      assert.equal(body.text.format.name, "garment_recognition");
      assert.equal(body.store, false);
      assert.equal(body.input[0].content.filter(item => item.type === "input_image").length, 1);
      assert.ok(!JSON.stringify(body).includes("WRONG_FILENAME"));
      calls.push("recognize");
      return Response.json({ output_text: JSON.stringify(result) }, { headers: { "x-request-id": "recognition-request" } });
    }
    if (url.endsWith("/images/edits")) {
      calls.push("generate"); prompts.push(options.body.get("prompt"));
      assert.ok(options.body.get("image[]") instanceof File);
      if (failGeneration) return Response.json({ error: { message: "Provider unavailable" } }, { status: 503 });
      return Response.json({ data: [{ b64_json: Buffer.from("master").toString("base64") }] });
    }
    if (url.endsWith("/files")) {
      const file = options.body.get("file");
      if (file.type === "application/jsonl") prompts.push((await file.text()).split("\n").map(line => JSON.parse(line).body.prompt).join("\n"));
      calls.push("file"); return Response.json({ id: `file-${calls.length}` });
    }
    if (url.endsWith("/batches")) { calls.push("batch"); return Response.json({ id: "batch-test", status: "validating" }); }
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
  return { sql, env, queued, calls, prompts, api, upload, deliver, row, failMetadata(value) { failMetadata = value; }, failGeneration(value) { failGeneration = value; } };
}

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
