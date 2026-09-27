import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../worker/google-auth.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
const { handleGoogleAuth } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
test("sign out expires both authentication cookies and returns to the closet", async () => {
  const response = await handleGoogleAuth(new Request("https://forme.gallery/auth/logout?return_to=%2Fcloset"), {});
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/closet");
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const name of ["__Host-forme_session", "__Host-forme_oauth_state"]) {
    const cookie = cookies.find(value => value.startsWith(`${name}=`));
    assert.ok(cookie);
    assert.match(cookie, /Max-Age=0/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
  }
});
