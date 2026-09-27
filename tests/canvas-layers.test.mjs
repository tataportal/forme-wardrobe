import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/canvas-layers.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm" });
const { moveCanvasLayer } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const order = items => [...items].sort((a, b) => a.z - b.z).map(item => item.instanceId);
test("pants can move above tops and jackets, and back down without moving the garments", () => {
  const original = [{ instanceId: "pants", z: 1001, x: 50 }, { instanceId: "top", z: 2001, x: 52 }, { instanceId: "jacket", z: 3001, x: 49 }];
  const first = moveCanvasLayer(original, "pants", "up");
  assert.deepEqual(order(first), ["top", "pants", "jacket"]);
  const second = moveCanvasLayer(first, "pants", "up");
  assert.deepEqual(order(second), ["top", "jacket", "pants"]);
  assert.equal(moveCanvasLayer(second, "pants", "up"), second);
  assert.deepEqual(order(moveCanvasLayer(second, "pants", "down")), order(first));
  assert.deepEqual(second.map(item => item.x), original.map(item => item.x));
  assert.equal(original[0].z, 1001);
  assert.deepEqual(order(JSON.parse(JSON.stringify(second))), order(second));
});
test("ties in older looks produce a stable order and missing selections do nothing", () => {
  const items = [{ instanceId: "a", z: 1 }, { instanceId: "b", z: 1 }];
  assert.deepEqual(order(moveCanvasLayer(items, "a", "up")), ["b", "a"]);
  assert.equal(moveCanvasLayer(items, "missing", "up"), items);
});
