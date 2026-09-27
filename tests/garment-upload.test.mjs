import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/garment-upload.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { processingFileFor, uploadFileError, uploadFingerprint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
test("invalid and oversized files fail before image decoding or intake", async () => {
  assert.match(uploadFileError({ name: "vacío.jpg", type: "image/jpeg", size: 0 }), /vacío/);
  assert.match(uploadFileError({ name: "foto.jpg", type: "image/jpeg", size: 21 * 1024 * 1024 }), /20 MB/);
  await assert.rejects(processingFileFor(new File(["<svg/>"], "foto.svg", { type: "image/svg+xml" })), /JPG/);
  assert.equal(uploadFileError({ name: "foto.HEIC", type: "", size: 5000 }), null);
});
test("unsupported HEIC decoding is actionable instead of uploading the unsupported original", async t => {
  globalThis.createImageBitmap ??= async () => { throw new Error("not supported"); };
  t.mock.method(globalThis, "createImageBitmap", async () => { throw new Error("not supported"); });
  await assert.rejects(processingFileFor(new File(["image"], "foto.heic", { type: "image/heic" })), /Exporta la foto como JPG/);
});
test("fingerprints distinguish different photos and recognize the same selection", () => {
  const a = { name: "photo.jpg", size: 90, lastModified: 3 };
  assert.equal(uploadFingerprint(a), uploadFingerprint({ ...a }));
  assert.notEqual(uploadFingerprint(a), uploadFingerprint({ ...a, lastModified: 4 }));
});
