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
        async run() { statement.run(...values); return { success: true }; },
      };
    } };
    const request = async (path, body) => {
      const response = await handleWardrobeApi(new Request(`http://localhost${path}`, body ? {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      } : undefined), { DB }, { waitUntil() {} });
      assert.equal(response.status, 200);
      return response.json();
    };
    const initial = (await request("/api/session")).user;
    assert.equal(initial.includeFormeBasics, false);
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
