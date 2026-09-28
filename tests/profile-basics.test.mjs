import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../worker/wardrobe-api.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", loader: { ".wasm": "binary" }, logLevel: "silent" });
const { handleWardrobeApi } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("basics default off and the profile preference persists independently of public visibility", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    const directory = new URL("../drizzle/", import.meta.url);
    for (const name of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
      sqlite.exec(await readFile(new URL(name, directory), "utf8"));
    }
    const DB = { prepare(sql) {
      const statement = sqlite.prepare(sql);
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async first() { return statement.get(...values) ?? null; },
        async run() { const result = statement.run(...values); return { success: true, meta: { changes: Number(result.changes) } }; },
      };
    } };
    const request = async (path, body, method = body ? "PUT" : "GET") => {
      const response = await handleWardrobeApi(new Request(`http://localhost${path}`, body ? {
        method, headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      } : { method }), { DB }, { waitUntil() {} });
      assert.equal(response.status, 200);
      return response.json();
    };
    const initial = (await request("/api/session")).user;
    assert.equal(initial.includeFormeBasics, false);
    assert.equal(initial.isTester, false);
    assert.equal(initial.credits, 10);
    assert.equal(initial.onboardingCompleted, false);
    const onboarding = await request("/api/onboarding/complete", undefined, "POST");
    assert.equal(onboarding.rewarded, true);
    assert.equal(onboarding.credits, 15);
    const repeatedOnboarding = await request("/api/onboarding/complete", undefined, "POST");
    assert.equal(repeatedOnboarding.rewarded, false);
    assert.equal(repeatedOnboarding.credits, 15);
    assert.equal((await request("/api/session")).user.onboardingCompleted, true);
    assert.equal(initial.joinedAt, `${sqlite.prepare("SELECT created_at FROM users WHERE id = ?").get(initial.id).created_at.replace(" ", "T")}Z`);
    sqlite.prepare("UPDATE users SET is_tester = 1 WHERE id = ?").run(initial.id);
    sqlite.prepare("INSERT INTO digitization_credit_events (id, owner_id, event_type, amount, source, idempotency_key) VALUES ('test-grant', ?, 'grant', 5, 'manual', 'test-grant')").run(initial.id);
    const refreshed = (await request("/api/session")).user;
    assert.equal(refreshed.isTester, true);
    assert.equal(refreshed.credits, 20, "session must reflect credits granted after onboarding and later grants");
    const protectedFields = (await request("/api/profile", { ...initial, isTester: false, credits: 999, joinedAt: "2000-01-01T00:00:00Z" })).profile;
    assert.equal(protectedFields.isTester, true, "profile edits cannot change tester status");
    assert.equal(protectedFields.credits, 20, "profile edits cannot grant credits");
    assert.equal(protectedFields.joinedAt, initial.joinedAt, "registration date cannot be edited");
    const enabled = (await request("/api/profile", { ...initial, includeFormeBasics: true })).profile;
    assert.equal(enabled.includeFormeBasics, true);
    assert.equal(enabled.profilePublic, false);
    assert.equal((await request("/api/session")).user.includeFormeBasics, true);
    const { includeFormeBasics, ...legacyClient } = enabled;
    await request("/api/profile", legacyClient);
    assert.equal((await request("/api/session")).user.includeFormeBasics, true, "older clients must not reset the preference");
    await request("/api/profile", { ...enabled, includeFormeBasics: false });
    assert.equal((await request("/api/session")).user.includeFormeBasics, false);
  } finally { sqlite.close(); }
});
