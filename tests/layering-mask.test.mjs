import assert from "node:assert/strict";
import test from "node:test";

import { pixelMaskPolygon, planInteriorOpening } from "../worker/layering-mask.ts";

const imageWidth = 1000;
const imageHeight = 1000;
const garmentBounds = { minX: 100, minY: 80, maxX: 900, maxY: 950 };

test("uses the detected inner contour and keeps a safety inset around garment fabric", () => {
  const polygon = pixelMaskPolygon([
    { x: 455, y: 170 },
    { x: 545, y: 170 },
    { x: 570, y: 300 },
    { x: 555, y: 500 },
    { x: 545, y: 940 },
    { x: 455, y: 940 },
    { x: 445, y: 500 },
    { x: 430, y: 300 },
  ], imageWidth, imageHeight);

  assert.ok(polygon);
  const plan = planInteriorOpening(polygon, imageWidth, imageHeight, garmentBounds);
  assert.equal(plan.passed, true);
  assert.ok(plan.spans.length > 700);
  assert.ok(plan.spans[0].start > polygon[0].x);
  assert.ok(plan.spans[0].end < polygon[1].x);
  assert.ok(plan.topWidthRatio < 0.22);
});

test("rejects a wide geometric opening that could eat collar and lapels", () => {
  const polygon = pixelMaskPolygon([
    { x: 350, y: 170 },
    { x: 650, y: 170 },
    { x: 650, y: 300 },
    { x: 560, y: 500 },
    { x: 545, y: 940 },
    { x: 455, y: 940 },
    { x: 440, y: 500 },
    { x: 350, y: 300 },
  ], imageWidth, imageHeight);

  assert.ok(polygon);
  const plan = planInteriorOpening(polygon, imageWidth, imageHeight, garmentBounds);
  assert.equal(plan.passed, false);
  assert.match(plan.notes, /demasiado ancha/);
});

test("rejects under-specified four-point masks", () => {
  assert.equal(pixelMaskPolygon([
    { x: 450, y: 180 },
    { x: 550, y: 180 },
    { x: 540, y: 940 },
    { x: 460, y: 940 },
  ], imageWidth, imageHeight), null);
});
