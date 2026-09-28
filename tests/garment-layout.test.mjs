import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const catalog = JSON.parse(await readFile(new URL("app/garment-layout-data.json", root), "utf8"));
const bundled = await build({ entryPoints: [fileURLToPath(new URL("app/garment-layout.ts", root))], bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent" });
const js = bundled.outputFiles[0].text;
const { measureGarmentAlpha, classifyGarmentLayout, matchOpenLayout, slotPlacement, layoutAnchorY, canvasSlotSpan, canvasBodyGrid, SLOT_GRID, prepareCanvasGarment, manualCanvasScaleMultiplier, replacementPlacement } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);

test("every catalog image has current, finite alpha and slot measurements", async () => {
  assert.equal(Object.keys(catalog.images).length, 262);
  for (const [image, profile] of Object.entries(catalog.images)) {
    assert.ok(profile.slots > 0 && profile.slots <= 7);
    assert.ok(profile.bodyHeight > 0 && profile.bodyHeight <= profile.bounds[3]);
    assert.ok(profile.shoulderY >= profile.bounds[1] - 0.000001);
    assert.ok(profile.hemY <= profile.bounds[1] + profile.bounds[3] + 0.000001);
    near(profile.hemY - profile.shoulderY, profile.bodyHeight);
    near(profile.shoulderY - profile.bounds[1], profile.neckRise);
    assert.ok(profile.sleeveBottoms.every(value => Number.isFinite(value) && value > profile.bounds[1]));
    assert.ok(profile.bounds.every(Number.isFinite));
    const bytes = await readFile(new URL(`public${image}`, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), profile.sha256, `${image} needs reanalysis`);
  }
});

test("torso measurement excludes long sleeves and transparent margins", () => {
  const data = new Uint8Array(100 * 100 * 4);
  const fill = (left, top, right, bottom) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) data[(y * 100 + x) * 4 + 3] = 255;
  };
  fill(30, 10, 69, 49); // Cropped torso.
  fill(10, 10, 29, 13); fill(70, 10, 89, 13); // Shoulder joins.
  fill(10, 10, 24, 89); fill(75, 10, 89, 89); // Long sleeves.
  const geometry = measureGarmentAlpha(data, 100, 100);
  assert.deepEqual(geometry.bounds, [0.1, 0.1, 0.8, 0.8]);
  near(geometry.bodyHeight, 0.4);
  assert.equal(classifyGarmentLayout({ category: "Tops", name: "Sweater", garmentType: "Sweater", silhouette: "Cropped" }, geometry).slots, 2);
  assert.equal(classifyGarmentLayout({ category: "Tops", name: "Sweater", garmentType: "Sweater", silhouette: "Regular" }, geometry).slots, 3);
});

test("a high collar and longer sleeves change the footprint, not the body's scale or slots", () => {
  const plain = new Uint8Array(100 * 128 * 4);
  const fill = (data, left, top, right, bottom) => {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) data[(y * 100 + x) * 4 + 3] = 255;
  };
  fill(plain, 30, 35, 69, 74);
  fill(plain, 10, 35, 29, 38); fill(plain, 70, 35, 89, 38);
  fill(plain, 10, 35, 24, 90); fill(plain, 75, 35, 89, 90);
  const extended = plain.slice();
  fill(extended, 25, 5, 74, 34); // Broad, tall collar/hood.
  fill(extended, 10, 91, 24, 117); fill(extended, 75, 91, 89, 117); // Longer cuffs.
  const before = measureGarmentAlpha(plain, 100, 128);
  const after = measureGarmentAlpha(extended, 100, 128, { wideNeck: true });
  near(before.bodyHeight, after.bodyHeight);
  near(before.shoulderY, after.shoulderY);
  near(after.neckRise, 30 / 128);
  assert.ok(after.sleeveBottoms.every((value, i) => value > before.sleeveBottoms[i]));
  const regular = { category: "Tops", name: "Sweater", garmentType: "Sweater", silhouette: "Regular" };
  assert.equal(classifyGarmentLayout(regular, before).slots, 3);
  assert.equal(classifyGarmentLayout(regular, after).slots, 3);
  near(3 / before.bodyHeight, 3 / after.bodyHeight);
  assert.equal(classifyGarmentLayout({ ...regular, bodyLength: "cropped" }, after).slots, 2);
});

test("an open cutout retains the closed garment's shoulder, hem and cuff proportions", () => {
  let pairs = 0;
  for (const [image, closed] of Object.entries(catalog.images)) {
    if (image.endsWith('-c.png')) continue;
    const open = catalog.images[image.replace('.png', '-c.png')];
    if (!open) continue;
    pairs++;
    const matched = matchOpenLayout(closed, open);
    assert.equal(matched.slots, closed.slots);
    near(matched.bodyHeight / open.bounds[3], closed.bodyHeight / closed.bounds[3]);
    near((matched.shoulderY - open.bounds[1]) / open.bounds[3], (closed.shoulderY - closed.bounds[1]) / closed.bounds[3]);
  }
  assert.equal(pairs, 42);
});

test("shoulders and waist follow the approved reference while collars and cuffs remain intact", () => {
  const frames = [{ width: 420, height: 656, baseWidth: 319.2 }, { width: 530, height: 936, baseWidth: 402.8 }, { width: 390, height: 680, baseWidth: 296.4 }];
  for (const [image, profile] of Object.entries(catalog.images)) {
    if (profile.region === "accessory") continue;
    const garment = { image, category: profile.region === "lower" ? "Bottoms" : "Tops", name: "Test", garmentType: "Top", silhouette: "Regular" };
    for (const frame of frames) {
      const span = canvasSlotSpan(profile);
      const grid = canvasBodyGrid(frame);
      const placement = slotPlacement(garment, "closed", frame);
      const imageHeight = frame.baseWidth * 1.25 * placement.scale;
      const silhouetteTop = placement.y / 100 + (profile.bounds[1] - 0.5) * imageHeight / frame.height;
      const silhouetteBottom = silhouetteTop + profile.bounds[3] * imageHeight / frame.height;
      assert.ok(silhouetteTop >= 0 && silhouetteBottom <= 0.96, `${image}: full collar/cuffs must fit, got ${silhouetteTop}–${silhouetteBottom}`);
      const anchor = placement.y / 100 + (layoutAnchorY(profile) - 0.5) * imageHeight / frame.height;
      near(anchor, profile.region === "lower" ? 0.39 : profile.region === "feet" ? grid.footBaseline - span * grid.height : grid.upper);
      if (profile.region === "upper") {
        const visibleTop = placement.y / 100 + (profile.bounds[1] - 0.5) * imageHeight / frame.height;
        near(anchor - visibleTop, profile.neckRise * imageHeight / frame.height);
        assert.ok(placement.y / 100 + (profile.hemY - 0.5) * imageHeight / frame.height <= grid.upper + span * grid.height + 1e-6);
      }
      const bodyHeight = imageHeight * (profile.region === "upper" ? profile.bodyHeight : profile.bounds[3]) / frame.height;
      if (profile.region === "upper") {
        assert.ok(bodyHeight <= span * grid.height + 1e-6, "a width constraint can reduce the nominal length, never inflate it");
        assert.ok(bodyHeight >= span * grid.height * 0.65, "retain the garment's length class");
      } else near(bodyHeight, span * grid.height);
      near(placement.x / 100 + (profile.bounds[0] + profile.bounds[2] / 2 - 0.5) * frame.baseWidth * placement.scale / frame.width, 0.5);
    }
  }
});

test("overalls use the full garment, not the torso and not the trouser waistband", () => {
  const geometry = measureGarmentAlpha(new Uint8Array(100 * 100 * 4).fill(255), 100, 100);
  const profile = classifyGarmentLayout({ category: "Bottoms", name: "Overol negro", garmentType: "Trousers", silhouette: "Regular" }, geometry);
  assert.equal(profile.region, "full");
  assert.equal(profile.slots, 6.5);
  assert.equal(layoutAnchorY(profile), profile.bounds[1]);
});

test("long robes use their hem and cuffs, not a regular jacket's length", () => {
  for (const id of [41, 81]) {
    const image = `/wardrobe/final/${String(id).padStart(7, "0")}.png`;
    const geometry = catalog.images[image];
    const garment = { image, category: "Outerwear", name: "Prenda", garmentType: "Jacket", silhouette: "Regular" };
    assert.equal(classifyGarmentLayout(garment, geometry).slots, 4, "a renamed long robe still has a long body");
    assert.equal(geometry.slots, id === 41 ? 5 : 4, "the zibelinado's confirmed full length wins over the legacy fallback");
    assert.equal(classifyGarmentLayout({ ...garment, bodyLength: "cropped" }, geometry).slots, 2, "an explicit length wins over inferred geometry");
    for (const height of [460, 936, 1500]) {
      const frame = { width: height / 1.5, height, baseWidth: height / 1.5 * 0.76 };
      const placement = slotPlacement(garment, "closed", frame);
      const body = frame.baseWidth * 1.25 * placement.scale * geometry.bodyHeight;
      const trouserLength = height * canvasBodyGrid(frame).height * 5;
      assert.ok(body / trouserLength > 0.9 && body / trouserLength <= 1.3, "long robes reach below the hips instead of being reduced to a regular jacket");
    }
  }
  for (const name of ["Camisa de manga larga", "Long-sleeved shirt", "Long sleeve shirt"]) {
    const geometry = catalog.images["/wardrobe/final/0000043.png"];
    const garment = { category: "Tops", name, garmentType: "Shirt", silhouette: "Regular" };
    assert.equal(classifyGarmentLayout(garment, geometry).slots, 3, "long sleeves alone do not imply a long body");
    assert.equal(classifyGarmentLayout({ ...garment, name: "Sobrecamisa larga" }, geometry).slots, 4);
  }
  const tee = catalog.images["/wardrobe/final/0000067.png"];
  assert.equal(classifyGarmentLayout({ category: "Tops", name: "T-shirt", garmentType: "T-shirt", silhouette: "Regular" }, tee).slots, 3, "a short-sleeved tee must not be promoted to a robe");
});

test("both bucket hats have a readable head scale beside full-length trousers", () => {
  for (const height of [460, 900, 1500]) {
    const frame = { width: height / 1.5, height, baseWidth: height / 1.5 * 0.76 };
    const pantsImage = "/wardrobe/final/0000124.png";
    const pants = slotPlacement({ image: pantsImage, name: "Pantalón blanco ancho", category: "Bottoms" }, "closed", frame);
    const pantsWidth = catalog.images[pantsImage].bounds[2] * frame.baseWidth * pants.scale;
    for (const id of [121, 122]) {
      const image = `/wardrobe/final/${String(id).padStart(7, "0")}.png`, profile = catalog.images[image];
      const placement = slotPlacement({ image, name: "Bucket hat", garmentType: "Hat", category: "Accessories" }, "closed", frame);
      const width = frame.baseWidth * placement.scale;
      assert.ok(profile.bounds[2] * width / pantsWidth > 0.55 && profile.bounds[2] * width / pantsWidth < 0.6, "bucket width follows the user's reference beside these wide-leg trousers");
      const top = placement.y / 100 * height + (profile.bounds[1] - 0.5) * width * 1.25;
      assert.ok(top > 0, "the larger hat remains inside the snapshot");
    }
  }
});

test("the zibelinado follows the user's full-length reference without changing regular coats", () => {
  const image = "/wardrobe/final/0000041.png";
  const garment = { image, category: "Outerwear", name: "Kimono Zibelinado", garmentType: "Poncho", silhouette: "Draped", bodyLength: "maxi" };
  assert.equal(classifyGarmentLayout(garment, catalog.images[image]).slots, 5);
  const placement = slotPlacement(garment);
  const userReferenceScale = 1.11261; // User-sized look, 2026-09-08; reference document is 1000 × 1500.
  assert.ok(Math.abs(placement.scale / userReferenceScale - 1) < 0.03, "automatic scale must stay within 3% of the user's reference");
  const bucket = slotPlacement({ image: "/wardrobe/final/0000122.png", name: "Bucket hat con parche", category: "Accessories", garmentType: "Hat" });
  assert.ok(Math.abs(bucket.scale / 0.40849 - 1) < 0.01, "bucket scale must stay within 1% of the user's final adjustment");
  assert.equal(catalog.images["/wardrobe/final/0000002.png"].slots, 3);
  assert.equal(catalog.images["/wardrobe/final/0000003.png"].slots, 4);
});

test("the bomber and straight jeans use a shared torso-to-leg proportion, not equal heights", () => {
  const frame = { width: 530, height: 936, baseWidth: 402.8 };
  const metrics = image => {
    const p = catalog.images[image];
    const placed = slotPlacement({ image, category: p.region === "lower" ? "Bottoms" : "Outerwear", name: "Test" }, "closed", frame);
    const imageHeight = frame.baseWidth * 1.25 * placed.scale;
    return { width: imageHeight / 1.25 * p.bounds[2], body: imageHeight * (p.region === "upper" ? p.bodyHeight : p.bounds[3]),
      top: placed.y / 100 + (layoutAnchorY(p) - 0.5) * imageHeight / frame.height,
      hem: placed.y / 100 + (p.hemY - 0.5) * imageHeight / frame.height,
      bottom: placed.y / 100 + (p.bounds[1] + p.bounds[3] - 0.5) * imageHeight / frame.height };
  };
  const bomber = metrics("/wardrobe/final/0000171.png");
  const jeans = metrics("/wardrobe/final/0000155.png");
  assert.ok(bomber.body / jeans.body > 0.55 && bomber.body / jeans.body <= 0.6);
  assert.ok(bomber.width / jeans.width < 1.85, "the bomber must not dwarf the jeans (previously 2.53x their width)");
  assert.ok(bomber.width / jeans.width > 1.5, "preserve the bomber's relaxed silhouette");
  assert.ok(bomber.hem > jeans.top, "a regular jacket covers the waistband, not a gap above it");
  near(jeans.top, 0.39);
  near(jeans.bottom, 0.39 + canvasBodyGrid(frame).height * 5);
  near(SLOT_GRID.footBaseline, 0.9);
});

test("short screens reserve toolbar space without changing the torso-to-leg ratio or waist anchor", () => {
  for (const height of [460, 656, 936, 1500]) {
    const grid = canvasBodyGrid({ width: 390, height, baseWidth: 296.4 });
    near(grid.lower, 0.39);
    const overlap = grid.upper + grid.height * 2.2 - grid.lower;
    assert.ok(overlap > 0 && overlap < 0.02, "cropped hem meets the waist with a slight overlap");
    near(3 * grid.height / (5 * grid.height), 0.6);
    assert.ok(grid.footBaseline * height <= height - 72 + 1e-6);
  }
});

test("cropped, regular and long uppers share shoulders while preserving distinct hems", () => {
  const endsAt = slots => SLOT_GRID.upper + canvasSlotSpan({ region: "upper", slots }) * SLOT_GRID.height;
  near(endsAt(2), 0.4024);
  near(endsAt(3), 0.476);
  near(endsAt(3.5), 0.545);
  near(endsAt(4), 0.66);
  near(endsAt(5), 0.844);
});

test("cream reference look keeps its measured proportions and connections at different viewport sizes", () => {
  for (const frame of [{ width: 426, height: 656, baseWidth: 323.76 }, { width: 660, height: 1140, baseWidth: 501.6 }]) {
    const metric = (id, type) => {
      const image = `/wardrobe/final/${String(id).padStart(7, "0")}.png`, p = catalog.images[image];
      const placed = slotPlacement({ image, name: "Reference", garmentType: type }, "closed", frame);
      const w = frame.baseWidth * placed.scale, h = w * 1.25;
      return { width: p.bounds[2] * w, height: p.bounds[3] * h, body: p.bodyHeight * h,
        centerX: placed.x / 100 * frame.width + (p.bounds[0] + p.bounds[2] / 2 - 0.5) * w,
        top: placed.y / 100 * frame.height + (p.bounds[1] - 0.5) * h,
        bottom: placed.y / 100 * frame.height + (p.bounds[1] + p.bounds[3] - 0.5) * h,
        hem: placed.y / 100 * frame.height + (p.hemY - 0.5) * h };
    };
    const jacket = metric(173), trousers = metric(194), shoes = metric(208), glasses = metric(212, "Glasses"), bag = metric(215, "Bag");
    near(jacket.body / trousers.height, 0.44);
    assert.ok(jacket.width / trousers.width > 1.2 && jacket.width / trousers.width < 1.3);
    assert.ok(jacket.height / trousers.height > 0.6 && jacket.height / trousers.height < 0.67);
    assert.ok(jacket.hem > trousers.top && jacket.hem - trousers.top < frame.height * 0.02);
    assert.ok(shoes.top < trousers.bottom && shoes.bottom > trousers.bottom);
    assert.ok(shoes.width / trousers.width > 0.5 && shoes.width / trousers.width < 0.6);
    assert.ok(glasses.bottom < jacket.top && jacket.top - glasses.bottom < frame.height * 0.04);
    assert.ok(bag.centerX < jacket.centerX);
    assert.ok(bag.width / jacket.width > 0.55 && bag.width / jacket.width < 0.65);
    assert.ok(shoes.bottom <= frame.height - 72 + 1e-6);
  }
});

test("pipeline anatomy and catalog measurements use the same proportional projection", () => {
  for (const image of ["/wardrobe/final/0000171.png", "/wardrobe/final/0000155.png", "/wardrobe/final/0000172.png"]) {
    const profile = catalog.images[image];
    const known = { image, name: "Catalog" };
    const uploaded = { image: "/api/images/new-cutout.png", name: "Upload", anatomy: { version: 1, closed: profile, open: null } };
    assert.deepEqual(slotPlacement(uploaded), slotPlacement(known));
  }
});

test("wide sweatshirts and bombers fit the body without stretching or lifting above the waist", () => {
  const frame = { width: 1000, height: 1500, baseWidth: 760 };
  for (const [image, category, maxWidth] of [["/wardrobe/final/0000086.png", "Tops", 470], ["/wardrobe/final/0000018-c.png", "Outerwear", 510]]) {
    const p = catalog.images[image];
    const placed = slotPlacement({ image, name: "Wide garment", category, silhouette: "Regular" }, "closed", frame);
    const width = frame.baseWidth * placed.scale;
    const height = width * 1.25;
    assert.ok(p.bounds[2] * width < maxWidth, "the visible garment must no longer occupy most of the canvas width");
    near(height / width, 1.25);
    near(placed.y / 100 + (p.shoulderY - 0.5) * height / frame.height, SLOT_GRID.upper);
    assert.ok(placed.y / 100 + (p.hemY - 0.5) * height / frame.height > SLOT_GRID.lower);
  }
});

test("transparent padding cannot change an accessory's visible size or placement", () => {
  const frame = { width: 1000, height: 1500, baseWidth: 760 };
  const metric = (bounds, garmentType) => {
    const p = { bounds, region: "accessory", slots: 1 };
    const garment = { image: "/new.png", name: garmentType, garmentType, category: "Accessories", anatomy: { version: 1, closed: p } };
    const placed = slotPlacement(garment, "closed", frame), w = frame.baseWidth * placed.scale, h = w * 1.25;
    return { width: bounds[2] * w, height: bounds[3] * h, x: placed.x * 10 + (bounds[0] + bounds[2] / 2 - 0.5) * w, y: placed.y * 15 + (bounds[1] + bounds[3] / 2 - 0.5) * h };
  };
  for (const kind of ["Hat", "Glasses", "Bag", "Accessory", "Belt", "Scarf"]) {
    const a = metric([0.1, 0.1, 0.8, 0.8], kind), b = metric([0.3, 0.3, 0.4, 0.4], kind);
    for (const key of ["width", "height", "x", "y"]) near(a[key], b[key]);
  }
});

test("hats, glasses, belts and scarves have readable sizes and appropriate body anchors", () => {
  const cases = [[121, "Hat"], [122, "Hat"], [167, "Hat"], [168, "Hat"], [217, "Hat"], [218, "Hat"], [169, "Glasses"], [212, "Glasses"], [219, "Belt"], [220, "Scarf"]];
  for (const height of [460, 900, 1500]) {
    const frame = { width: height / 1.5, height, baseWidth: height / 1.5 * 0.76 }, grid = canvasBodyGrid(frame);
    for (const [id, type] of cases) {
      const image = `/wardrobe/final/${String(id).padStart(7, "0")}.png`, p = catalog.images[image];
      const s = slotPlacement({ image, name: type, garmentType: type, category: "Accessories" }, "closed", frame);
      const w = frame.baseWidth * s.scale, h = w * 1.25;
      const top = s.y / 100 + (p.bounds[1] - 0.5) * h / frame.height;
      const bottom = top + p.bounds[3] * h / frame.height;
      near(s.x / 100 + (p.bounds[0] + p.bounds[2] / 2 - 0.5) * w / frame.width, 0.5);
      assert.ok(top > 0 && bottom < 1, "all of the accessory must remain in the frame");
      if (type === "Hat" || type === "Glasses") {
        assert.ok(p.bounds[2] * w / (frame.height * grid.height) > 0.9, "head accessories must not become tiny thumbnails");
        assert.ok(bottom < grid.upper);
      }
      if (type === "Belt") assert.ok(Math.abs((top + bottom) / 2 - grid.lower) < 0.02);
      if (type === "Scarf") assert.ok(Math.abs((top + bottom) / 2 - grid.upper) < 0.03);
    }
  }
});

test("opening a saved look does not silently rescale or reposition its pieces", async () => {
  const page = await readFile(new URL("app/wardrobe-app.tsx", root), "utf8");
  const normalization = page.slice(page.indexOf("function normalizedCanvasPiece("), page.indexOf("function initialSlotPiece("));
  assert.match(normalization, /return piece;/);
  assert.doesNotMatch(normalization, /scale:|y:|x:/);
  assert.match(page, /replacementPlacement/);
  assert.match(page, /change: \(instanceId, geometry\) => \{\s*autoPlacedIds\.current\.delete\(instanceId\)/);
});

test("typed accessories keep their placement when renamed; one-pieces use a full-length base", () => {
  const base = { category: "Accessories", image: "test-new-upload", name: "Mi favorita", garmentType: "Belt", silhouette: "Regular" };
  const belt = slotPlacement(base);
  assert.deepEqual(slotPlacement({ ...base, name: "Gorro de recuerdo" }), belt);
  const scarf = slotPlacement({ ...base, garmentType: "Scarf" });
  assert.notDeepEqual(scarf, belt);
  for (const garmentType of ["Dress", "Jumpsuit", "Overalls"]) {
    const item = { ...base, category: "One-pieces", garmentType, lengthOverride: "midi" };
    const placement = slotPlacement(item);
    assert.ok(Number.isFinite(placement.scale) && placement.scale > 0);
    const geometry = measureGarmentAlpha(new Uint8Array(100 * 125 * 4).fill(255), 100, 125);
    assert.equal(classifyGarmentLayout(item, geometry).region, "full");
  }
});


test("canvas replacements wait for decoded pixels, reuse warm images and retry failed images", async () => {
  const savedImage = globalThis.Image, savedDocument = globalThis.document;
  let release, calls = 0, fail = false;
  globalThis.document = {};
  globalThis.Image = class {
    decode() { calls++; return fail ? Promise.reject(new Error("offline")) : new Promise(resolve => { release = resolve; }); }
  };
  const anatomy = { version:1, closed:{}, open:{} };
  try {
    let complete = false;
    const item = { image:"decoded-closed", openImage:"decoded-open", anatomy };
    const first = prepareCanvasGarment(item).then(() => { complete = true; });
    await Promise.resolve();
    assert.equal(complete, false, "must not swap geometry before the new image is ready");
    const second = prepareCanvasGarment(item);
    assert.equal(calls, 1, "concurrent requests share one image decode");
    release(); await Promise.all([first, second]);
    await prepareCanvasGarment(item);
    assert.equal(calls, 1, "mixing a previously prepared image is immediate");
    fail = true;
    const retry = { ...item, openImage:"retry-open" };
    await assert.rejects(prepareCanvasGarment(retry), /offline/);
    fail = false;
    const recovered = prepareCanvasGarment(retry); release(); await recovered;
    assert.equal(calls, 3, "a failed decode does not poison the next mix");
  } finally { globalThis.Image = savedImage; globalThis.document = savedDocument; }
});


test("manual size overrides automatic scale, survives reuse, and transfers proportionally to the open cutout", () => {
  const garment = { id:"coat", name:"Coat", category:"Outerwear", garmentType:"Jacket", silhouette:"Regular", image:"/wardrobe/final/0000002.png", openImage:"/wardrobe/final/0000002-c.png" };
  const closed = slotPlacement(garment, "closed"), open = slotPlacement(garment, "open");
  const factor = manualCanvasScaleMultiplier(garment, "closed", closed.scale * 1.2);
  near(factor,1.2);
  const preferred = { ...garment, canvasScaleMultiplier:factor };
  near(slotPlacement(preferred,"closed").scale,closed.scale*1.2);
  near(slotPlacement(preferred,"open").scale,open.scale*1.2);
  near(manualCanvasScaleMultiplier(preferred,"closed",closed.scale*1.2),1.2); // no compounding
  const previous = { ...garment,id:"previous" };
  const piece = {instanceId:"p",garmentId:"previous",variant:"closed",...closed,scale:closed.scale*.8,rotation:0,z:1};
  near(replacementPlacement(piece,previous,preferred,"closed").scale,closed.scale*1.2);
  near(piece.scale,closed.scale*.8); // existing composition stays untouched
});
