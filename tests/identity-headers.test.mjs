import assert from "node:assert/strict";
import test from "node:test";
import { bundleModule } from "./helpers/legal-fixture.mjs";

const { guardAdminPage, handleAdminApi } = await bundleModule("../../worker/admin-api.ts");
const { handleWardrobeApi } = await bundleModule("../../worker/wardrobe-api.ts");

test("production never trusts client-supplied identity headers", async () => {
  const headers = {
    "oai-authenticated-user-email": "owner@example.test",
    "cf-access-authenticated-user-email": "owner@example.test",
  };
  const env = { FORME_OWNER_EMAIL: "owner@example.test", SESSION_SECRET: "test-secret" };

  const page = await guardAdminPage(new Request("https://forme.gallery/admin", { headers }), env);
  assert.equal(page.status, 302);
  assert.equal(page.headers.get("location"), "https://forme.gallery/ingresar?return_to=%2Fadmin");

  const admin = await handleAdminApi(new Request("https://forme.gallery/api/admin/commerce", { headers }), env);
  assert.equal(admin.status, 403);

  const account = await handleWardrobeApi(new Request("https://forme.gallery/api/session", { headers }), env, { waitUntil() {} });
  assert.equal(account.status, 503, "spoofed identity must not reach account or database access");
});

test("local preview identity headers remain available for development", async () => {
  const request = new Request("http://localhost/admin", {
    headers: { "oai-authenticated-user-email": "owner@example.test" },
  });
  assert.equal(await guardAdminPage(request, { FORME_OWNER_EMAIL: "owner@example.test" }), null);
});
