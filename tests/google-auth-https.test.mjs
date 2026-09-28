import assert from "node:assert/strict";
import test from "node:test";
import { bundleModule, consentRequest, env } from "./helpers/legal-fixture.mjs";
const { enforceProductionHttps, handleGoogleAuth } = await bundleModule("../../worker/google-auth.ts");

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
    const response = await handleGoogleAuth(consentRequest({}, { origin: `${protocol}://forme.gallery` }), env);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.searchParams.get("redirect_uri"), "https://forme.gallery/auth/google/callback");
  }
});

test("login defaults to the real closet instead of the red brand page", async () => {
  const env = { GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", SESSION_SECRET: "test-session" };
  const response = await handleGoogleAuth(consentRequest(), env);
  const stateCookie = response.headers.get("set-cookie") ?? "";
  const encodedState = stateCookie.match(/__Host-forme_oauth_state=([^;]+)/)?.[1];
  assert.ok(encodedState);
  const padded = encodedState.split(".")[0].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encodedState.split(".")[0].length / 4) * 4, "=");
  const state = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  assert.equal(state.returnTo, "/closet");
});

test("referral code survives the consent step inside signed OAuth state", async () => {
  const response = await handleGoogleAuth(consentRequest({ ref: "Pepito_50" }), env);
  const stateCookie = response.headers.get("set-cookie") ?? "";
  const encodedState = stateCookie.match(/__Host-forme_oauth_state=([^;]+)/)?.[1];
  assert.ok(encodedState);
  const payload = encodedState.split(".")[0];
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "=");
  const state = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  assert.equal(state.referralCode, "pepito_50");
});
