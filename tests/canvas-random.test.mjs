import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/canvas-random.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { randomGarmentReplacements, randomLookGarments } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const garment = (id, category = "Tops", garmentType = "T-shirt", status = "ready") => ({ id, category, garmentType, status, name: id, silhouette: "Regular", image: `/test/${id}.png` });
const garments = [garment("top-a"), garment("top-b"), garment("top-c"), garment("pants-a", "Bottoms", "Trousers"), garment("pants-b", "Bottoms", "Trousers"),
  garment("bag-a", "Accessories", "Bag"), garment("bag-b", "Accessories", "Bag"), garment("glasses", "Accessories", "Glasses")];
const pieces = [{ instanceId: "top", garmentId: "top-a" }, { instanceId: "pants", garmentId: "pants-a" }, { instanceId: "bag", garmentId: "bag-a" }];

test("an empty canvas can start a varied look with one garment per role", () => {
  const closet = [...garments, garment("jacket", "Outerwear", "Jacket"), garment("shoes", "Footwear", "Sneakers")];
  const first = randomLookGarments(closet, () => 0);
  assert.deepEqual(first.map(item => item.id), ["pants-a", "top-a", "jacket", "shoes", "bag-a"]);
  assert.equal(new Set(first.map(item => item.id)).size, first.length);
  const last = randomLookGarments(closet, () => 0.999);
  assert.equal(last.find(item => item.category === "Tops").id, "top-c");
  assert.equal(last.find(item => item.category === "Bottoms").id, "pants-b");
  assert.equal(closet.length, 10, "building a look must not change the closet");
});

test("a full-body garment replaces the top and bottom in a new look", () => {
  const overalls = { ...garment("overalls", "Bottoms", "Trousers"), name: "Overol negro" };
  const result = randomLookGarments([...garments, overalls], () => 0.999);
  assert.ok(result.some(item => item.id === overalls.id));
  assert.equal(result.filter(item => ["Tops", "Bottoms"].includes(item.category)).length, 1);
});

test("a new mix works with an incomplete closet and never uses unavailable garments", () => {
  const top = garment("only-top");
  assert.deepEqual(randomLookGarments([top]), [top]);
  assert.deepEqual(randomLookGarments([garment("failed", "Tops", "T-shirt", "failed"), garment("processing", "Tops", "T-shirt", "processing"), { ...top, image: "" }, { ...top, qaStatus: "review" }]), []);
  assert.deepEqual(randomLookGarments([]), []);
});

test("starting from empty respects disabled basics and supports a guest's basics", () => {
  const basic = { ...garment("basic"), collection: "forme" };
  const personal = garment("personal");
  assert.deepEqual(randomLookGarments([basic], () => 0, false), []);
  assert.deepEqual(randomLookGarments([personal, basic], () => 0.999, false), [personal]);
  assert.deepEqual(randomLookGarments([basic], () => 0, true), [basic]);
});

test("random changes upper and lower garments, preserving category and accessory type", () => {
  const result = randomGarmentReplacements(garments, pieces, new Set(), () => 0);
  assert.equal(result.get("top").id, "top-b");
  assert.equal(result.get("pants").id, "pants-b");
  assert.equal(result.get("bag").id, "bag-b");
  assert.equal(result.size, 3);
  assert.equal(pieces[0].garmentId, "top-a", "must not mutate the canvas snapshot");
});

test("only explicitly locked instances are kept, including when everything is locked", () => {
  assert.equal(randomGarmentReplacements(garments, pieces, new Set(["top"])).has("top"), false);
  assert.equal(randomGarmentReplacements(garments, pieces, new Set(pieces.map(piece => piece.instanceId))).size, 0);
  const unlocked = randomGarmentReplacements(garments, pieces, new Set());
  assert.equal(unlocked.has("top"), true, "unlock makes it eligible again");
});

test("different random draws reach different candidates rather than five preset recipes", () => {
  const first = randomGarmentReplacements(garments, pieces, new Set(), () => 0);
  const last = randomGarmentReplacements(garments, pieces, new Set(), () => 0.999);
  assert.notEqual(first.get("top").id, last.get("top").id);
  for (const [instance, replacement] of first) assert.notEqual(replacement.id, pieces.find(piece => piece.instanceId === instance).garmentId);
});

test("no replacement is better than using a processing, failed or rejected garment", () => {
  const unavailable = [garment("top-a"), garment("processing", "Tops", "T-shirt", "processing"), garment("failed", "Tops", "T-shirt", "failed"), { ...garment("review"), qaStatus: "review" }];
  assert.equal(randomGarmentReplacements(unavailable, [pieces[0]], new Set()).size, 0);
  assert.equal(randomGarmentReplacements(garments, [], new Set()).size, 0);
});

test("random does not choose a garment already pinned elsewhere", () => {
  const current = [pieces[0], { instanceId: "pinned", garmentId: "top-b" }];
  const result = randomGarmentReplacements(garments, current, new Set(["pinned"]), () => 0);
  assert.equal(result.get("top").id, "top-c");
  assert.equal(result.has("pinned"), false);
});

test("disabled basics cannot enter a mix, but existing basics can be replaced with personal garments", () => {
  const basic = { ...garment("basic"), collection: "forme" };
  const personal = garment("personal");
  const current = [{ instanceId: "top", garmentId: "personal" }];
  assert.equal(randomGarmentReplacements([personal, basic], current, new Set(), () => 0, false).size, 0);
  assert.equal(randomGarmentReplacements([personal, basic], current, new Set(), () => 0, true).get("top").id, "basic");
  const existing = [{ instanceId: "top", garmentId: "basic" }];
  assert.equal(randomGarmentReplacements([personal, basic], existing, new Set(), () => 0, false).get("top").id, "personal");
  assert.equal(existing[0].garmentId, "basic", "the saved composition remains untouched");
});
