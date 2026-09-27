import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../worker/google-auth.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
const { enforceProductionHttps, handleGoogleAuth } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("HTTP production login redirects before issuing secure OAuth cookies", () => {
  const result = enforceProductionHttps(new Request("http://forme.gallery/auth/google/start?return_to=%2Fcloset"));
  assert.equal(result.status, 308);
  assert.equal(result.headers.get("location"), "https://forme.gallery/auth/google/start?return_to=%2Fcloset");
  assert.equal(result.headers.get("set-cookie"), null);
});

test("HTTPS and local development requests are not redirected", () => {
  for (const url of ["https://forme.gallery/closet", "http://localhost:3002/closet"]) {
    assert.equal(enforceProductionHttps(new Request(url)), null);
  }
});

test("Google always receives the HTTPS production callback", async () => {
  const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", SESSION_SECRET: "test-session" };
  for (const protocol of ["http", "https"]) {
    const response = await handleGoogleAuth(new Request(`${protocol}://forme.gallery/auth/google/start`), env);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.searchParams.get("redirect_uri"), "https://forme.gallery/auth/google/callback");
  }
});

test("login defaults to the real closet instead of the red brand page", async () => {
  const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", SESSION_SECRET: "test-session" };
  const response = await handleGoogleAuth(new Request("https://forme.gallery/auth/google/start"), env);
  const stateCookie = response.headers.get("set-cookie") ?? "";
  const encodedState = stateCookie.match(/__Host-forme_oauth_state=([^;]+)/)?.[1];
  assert.ok(encodedState);
  const padded = encodedState.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encodedState.length / 4) * 4, "=");
  const state = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  assert.equal(state.returnTo, "/closet");
});
