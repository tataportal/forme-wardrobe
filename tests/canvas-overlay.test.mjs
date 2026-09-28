import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const bundle = await build({ entryPoints: [fileURLToPath(new URL("../app/canvas-overlay-bounds.ts", import.meta.url))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const { fitCanvasOverlay, visibleGarmentBounds, topCanvasPieceAtPoint } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);

test("a tap selects the top visible garment instead of a transparent image box", () => {
  const candidates = [
    { id: "pants", z: 1000, order: 0, rect: { left: 100, top: 220, width: 120, height: 260 } },
    { id: "jacket", z: 3000, order: 1, rect: { left: 80, top: 80, width: 180, height: 170 } },
  ];
  assert.equal(topCanvasPieceAtPoint(candidates, 160, 300, 10), "pants");
  assert.equal(topCanvasPieceAtPoint(candidates, 160, 230, 10), "jacket");
  assert.equal(topCanvasPieceAtPoint(candidates, 20, 20, 10), null);
});

test("all selection controls fit at every edge, including oversized and tiny pieces", () => {
  for (const width of [305, 425, 640]) for (const height of [180, 400, 740]) {
    const area = { left: 0, top: 0, width, height };
    for (const left of [-400, 0, width / 2, width - 10]) for (const top of [-300, 0, height / 2, height - 10]) {
      for (const size of [12, 160, 1100]) {
        const piece = { left, top, width: size, height: size * 1.25 };
        const original = { ...piece };
        const box = fitCanvasOverlay(piece, area);
        assert.ok(box.left - 22 >= 8 && box.top - 22 >= 8);
        assert.ok(box.left + box.width + 22 <= width - 8);
        assert.ok(box.top + box.height + 22 <= height - 8);
        assert.ok(box.width >= 104 && box.height >= 52);
        assert.deepEqual(piece, original, "must never alter garment geometry");
      }
    }
  }
});

test("an ordinary centered selection keeps its original bounds", () => {
  const piece = { left: 90, top: 140, width: 190, height: 240 };
  assert.deepEqual(fitCanvasOverlay(piece, { left: 0, top: 0, width: 425, height: 740 }), piece);
});

test("a clipped selection follows the visible garment instead of shifting its whole frame", () => {
  assert.deepEqual(fitCanvasOverlay({ left: -70, top: -30, width: 260, height: 310 },
    { left: 0, top: 0, width: 425, height: 740 }), { left: 30, top: 30, width: 160, height: 250 });
});

test("tiny accessories get centered controls without changing their size", () => {
  const piece = { left: 200, top: 200, width: 12, height: 16 };
  const box = fitCanvasOverlay(piece, { left: 0, top: 0, width: 425, height: 740 });
  assert.equal(box.left + box.width / 2, 206);
  assert.equal(box.top + box.height / 2, 208);
  assert.equal(box.width, 104);
  assert.equal(box.height, 144);
  const compact = fitCanvasOverlay(piece, { left: 0, top: 0, width: 425, height: 180 });
  assert.ok(compact.width >= 144 && compact.height >= 52 && compact.height < 144);
});

test("the outline follows the alpha bounds through scaling and rotation", () => {
  const rect = { left: 100, top: 200, width: 200, height: 250 };
  const size = { width: 400, height: 500 };
  const alpha = [.1, .2, .8, .6];
  assert.deepEqual(visibleGarmentBounds(rect, size, alpha, { a: .5, b: 0, c: 0, d: .5 }),
    { left: 120, top: 250, width: 160, height: 150 });
  const rotated = visibleGarmentBounds({ left: 75, top: 225, width: 250, height: 200 }, size, alpha,
    { a: 0, b: .5, c: -.5, d: 0 });
  for (const [key, value] of Object.entries({ left: 125, top: 245, width: 150, height: 160 })) assert.ok(Math.abs(rotated[key] - value) < 1e-9);
  assert.deepEqual(visibleGarmentBounds(rect, size, [], { a: 1, b: 0, c: 0, d: 1 }), rect);
});

test("mobile action corners stay reachable without reserving space for hidden gesture buttons", () => {
  for (const width of [280, 335, 425]) for (const height of [158, 364, 740]) {
    const area = { left: 0, top: 0, width, height };
    for (const piece of [{ left: 100, top: 100, width: 15, height: 12 }, { left: -200, top: -300, width: 1100, height: 1500 }]) {
      const box = fitCanvasOverlay(piece, area, true);
      assert.ok(box.width >= 104 && box.height >= 52);
      assert.ok(box.left >= 30 && box.top >= 30);
      assert.ok(box.left + box.width + 22 <= width - 8);
      assert.ok(box.top + box.height + 22 <= height - 8);
    }
  }
  assert.equal(fitCanvasOverlay({ left: 150, top: 150, width: 20, height: 15 }, { left: 0, top: 0, width: 335, height: 364 }, true).height, 52);
});
