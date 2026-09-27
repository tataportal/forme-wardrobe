import catalog from "./garment-layout-data.json";
import { accessoryKind, garmentRegion, validLengthOverride } from "../shared/garment-proportions";
import { slotsByRegion } from "../shared/garment-anatomy";
import type { Garment } from "./garments";
import type { AlphaGeometry, GarmentLayout } from "../shared/garment-anatomy";
export type { AlphaGeometry, GarmentLayout } from "../shared/garment-anatomy";
export type LayoutFrame = { width: number; height: number; baseWidth: number };

// Calibrated to the approved cream look: shoulders near 20%, waist near 40%,
// cropped torso 44% of trouser length, with a small hem/waistband overlap.
// The former 50% waist left a gap and pushed the whole composition too low.
export const SLOT_GRID = { height: 0.092, upper: 0.2, lower: 0.39, footBaseline: 0.9 } as const;
export const REFERENCE_FRAME: LayoutFrame = { width: 1000, height: 1500, baseWidth: 760 };
const measured = new Map<string, GarmentLayout>(Object.entries(catalog.images) as unknown as Array<[string, GarmentLayout]>);
const pending = new Map<string, Promise<void>>();
const displaySpans: Record<GarmentLayout["region"], Record<number, number>> = {
  upper: { 2: 2.2, 3: 3, 3.5: 3.75, 4: 5, 5: 7 },
  lower: { 1.5: 1.75, 2: 2.25, 2.5: 3.5, 3: 4.25, 3.5: 5 },
  full: { 4: 4.5, 5.5: 6, 6.5: 7 },
  feet: { 1: 1, 1.5: 1.5, 2.5: 2.5 },
  accessory: { 1: 1 },
};

export function canvasBodyGrid(frame: LayoutFrame) {
  // Keep the same proportions on shorter screens, above the 44px toolbar,
  // its 12px bottom inset and a 16px breathing gap. Scale about the reference
  // waist, not about each image independently; torso/leg ratios and overlap stay.
  const fit = Math.max(0.1, Math.min(1, (1 - 72 / frame.height - SLOT_GRID.lower) / (SLOT_GRID.footBaseline - SLOT_GRID.lower)));
  return {
    fit,
    height: SLOT_GRID.height * fit,
    upper: SLOT_GRID.lower + (SLOT_GRID.upper - SLOT_GRID.lower) * fit,
    lower: SLOT_GRID.lower,
    footBaseline: SLOT_GRID.lower + (SLOT_GRID.footBaseline - SLOT_GRID.lower) * fit,
  };
}

export function measureGarmentAlpha(data: ArrayLike<number>, width: number, height: number, options?: { wideNeck?: boolean }): AlphaGeometry {
  let left = width, top = height, right = -1, bottom = -1;
  const columnBottoms = new Int32Array(width).fill(-1);
  const columnTops = new Int32Array(width).fill(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] < 24) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      columnBottoms[x] = y;
      columnTops[x] = Math.min(columnTops[x], y);
    }
  }
  if (right < left || bottom < top) throw new Error("La prenda no tiene un contorno visible.");
  const quantile = (values: number[], fraction: number, fallback: number) => {
    values.sort((a, b) => a - b);
    return values[Math.floor((values.length - 1) * fraction)] ?? fallback;
  };
  const columns = (start: number, end: number) => [Math.ceil(left + (right - left) * start), Math.floor(left + (right - left) * end) + 1];
  // Sample the upper contour on BOTH sides of the neck, not its highest pixel.
  // A collar/hood can rise above this line without shortening the torso.
  const shoulder = (start: number, end: number) => quantile(Array.from(columnTops.slice(...columns(start, end))).filter(y => y < height), 0.8, top);
  // Use the inner shoulder, not a dropped sleeve seam. A visibly broad hood
  // needs its declared shape: alpha alone cannot distinguish fur from a torso.
  const shoulderY = options?.wideNeck
    ? (shoulder(0.14, 0.26) + shoulder(0.74, 0.86)) / 2
    : (shoulder(0.22, 0.36) + shoulder(0.64, 0.78)) / 2;
  // The central third excludes hanging sleeves. A percentile also ignores thin
  // drawstrings below the hem; there is no minimum based on the sleeve height.
  const [centerLeft, centerRight] = columns(0.34, 0.66);
  const hems = Array.from(columnBottoms.slice(centerLeft, centerRight + 1)).filter(y => y > top).sort((a, b) => a - b);
  const hemY = Math.max(shoulderY + 1, quantile(hems, 0.6, bottom) + 1);
  const cuff = (start: number, end: number) => quantile(Array.from(columnBottoms.slice(...columns(start, end))).filter(y => y >= top), 0.95, bottom) + 1;
  return {
    bounds: [left / width, top / height, (right - left + 1) / width, (bottom - top + 1) / height],
    shoulderY: shoulderY / height,
    hemY: hemY / height,
    neckRise: (shoulderY - top) / height,
    sleeveBottoms: [cuff(0, 0.14) / height, cuff(0.86, 1) / height],
    bodyHeight: (hemY - shoulderY) / height,
  };
}

export function classifyGarmentLayout(garment: Pick<Garment, "category" | "garmentType" | "name" | "silhouette" | "bodyLength">, geometry: AlphaGeometry): GarmentLayout {
  const text = `${garment.name} ${garment.garmentType} ${garment.silhouette}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const bodyDescription = text.replace(/long[- ]sleeve[ds]?|mangas? largas?/g, "");
  const bodyAspect = geometry.bodyHeight * 1.25 / geometry.bounds[2];
  const cuffHeight = Math.max(...geometry.sleeveBottoms) - geometry.shoulderY;
  // Legacy capes, robes and overshirts often have wide or short sleeves. Their
  // hem below both cuffs is stronger evidence of length than total image width.
  // Do not apply this to tees: short sleeves do not make a tee a long coat.
  const longOuterBody = (garment.category === "Outerwear" || garment.category === "Tailoring")
    && bodyAspect >= 1 && cuffHeight > 0 && geometry.bodyHeight / cuffHeight >= 1.4;
  let region: GarmentLayout["region"] = "upper";
  let slots = 3;
  if (garment.category === "One-pieces") { region = "full"; slots = /mini|corto/.test(text) ? 4 : /midi/.test(text) ? 5.5 : 6.5; }
  else if (garment.category === "Accessories") { region = "accessory"; slots = 1; }
  else if (garment.category === "Footwear") { region = "feet"; slots = /boot|bota/.test(text) ? 1.5 : 1; }
  else if (garment.category === "Bottoms") {
    region = "lower";
    slots = /short|bermuda/.test(text) ? 1.5
      : /mini|corta/.test(text) ? 2
      : /midi|culotte|cropped|capri/.test(text) ? 3
      : /skirt|falda/.test(text) && !/maxi|long|larga/.test(text) ? 2.5 : 3.5;
    if (/overol|jumpsuit|overall/.test(text)) { region = "full"; slots = 6.5; }
  } else if (garment.bodyLength === "cropped" || /cropped|crop top|baby tee|moto jacket/.test(text)) slots = 2;
  else if (garment.bodyLength === "regular") slots = 3;
  else if (garment.bodyLength === "long") slots = 4;
  else if (garment.bodyLength === "maxi") slots = 5;
  else if (/short coat/.test(text)) slots = 3;
  else if (/coat|trench|parka/.test(text) && bodyAspect > 1.7) slots = 5;
  else if (/trench|long coat|maxi|longline/.test(text)) slots = /trench|maxi|long coat/.test(text) ? 5 : 4;
  else if (/\b(?:long|largo|larga)\b/.test(bodyDescription) || longOuterBody) slots = 4;
  else if (/coat|abrigo|parka/.test(text)) slots = 4;
  else if (/blazer|suit jacket/.test(text)) slots = 3.5;
  else if (/poncho|cape/.test(text) && geometry.bodyHeight * 1.25 / geometry.bounds[2] > 1.3) slots = 4;
  // Sleeve length and collar height must NEVER decide whether a body is cropped.
  // Cropped is an explicit length classification, not body / full-silhouette ratio.
  return { ...geometry, slots, region };
}

function detectedGarmentLayout(garment: Garment, variant: "closed" | "open" = "closed"): GarmentLayout {
  const storedVariant = variant === "open" && garment.openImage ? "open" : "closed";
  const stored = garment.anatomy?.version === 1 ? garment.anatomy[storedVariant] : null;
  if (stored) return stored;
  const source = variant === "open" && garment.openImage ? garment.openImage : garment.image;
  const known = measured.get(source);
  if (known) return known;
  // Only used while a newly uploaded image is being measured. Static catalog
  // images have checked-in alpha measurements; ensureGarmentLayout handles new ones.
  const bounds: AlphaGeometry["bounds"] = [0.1, 0.08, 0.8, 0.84];
  const shoulderY = bounds[1] + 0.04;
  return classifyGarmentLayout(garment, { bounds, shoulderY, hemY: bounds[1] + bounds[3], neckRise: 0.04, sleeveBottoms: [0.92, 0.92], bodyHeight: bounds[3] - 0.04 });
}

export function garmentLayout(garment: Garment, variant: "closed" | "open" = "closed"): GarmentLayout {
  let profile = detectedGarmentLayout(garment, variant);
  // A user correction of type must not keep an incompatible old region.
  const region = garmentRegion(garment);
  if (garment.category && (garment.anatomy || garment.category === "One-pieces") && profile.region !== region && !(profile.region === "full" && garment.category === "Bottoms" && /overol|jumpsuit|overall/i.test(garment.name))) profile = classifyGarmentLayout(garment, profile);
  if (!validLengthOverride(garment, garment.lengthOverride)) return profile;
  return { ...profile, region, slots: slotsByRegion[region][garment.lengthOverride] };
}

export function layoutAnchorY(profile: GarmentLayout): number {
  return profile.region === "upper" ? profile.shoulderY : profile.bounds[1];
}

export function matchOpenLayout(closed: GarmentLayout, open: GarmentLayout): GarmentLayout {
  // The layering cutout removes the center used to measure the hem. Map the
  // closed garment's landmarks through its silhouette, retaining its anatomy.
  const ratio = open.bounds[3] / closed.bounds[3];
  const mapY = (y: number) => open.bounds[1] + (y - closed.bounds[1]) * ratio;
  return { ...open, slots: closed.slots, region: closed.region, shoulderY: mapY(closed.shoulderY), hemY: mapY(closed.hemY), neckRise: closed.neckRise * ratio, bodyHeight: closed.bodyHeight * ratio, sleeveBottoms: closed.sleeveBottoms.map(mapY) as [number, number] };
}

export function canvasSlotSpan(profile: Pick<GarmentLayout, "region" | "slots">): number {
  // Stored slots are length classes, not pixel sizes. Project both the legacy
  // catalogue and pipeline measurements onto the SAME body reference without
  // rewriting assets, stored anatomy or user-owned saved look coordinates.
  return displaySpans[profile.region][profile.slots] ?? profile.slots;
}

export function slotPlacement(garment: Garment, variant: "closed" | "open" = "closed", frame = REFERENCE_FRAME) {
  const profile = garmentLayout(garment, variant);
  const grid = canvasBodyGrid(frame);
  const unit = frame.height * grid.height;
  if (profile.region === "accessory") {
    const kind = accessoryKind(garment);
    const glasses = kind === "Glasses", bag = kind === "Bag", hat = kind === "Hat";
    const belt = kind === "Belt", scarf = kind === "Scarf";
    const [left, top, width, height] = profile.bounds;
    // Fit the visible accessory to its body region. Padding and portrait-shaped
    // objects must not decide whether a hat is tiny or runs outside the frame.
    const targetWidth = unit * (glasses ? 1.2 : hat ? 1.4 : bag ? 1.6 : belt ? 2.1 : 1.35);
    const maxHeight = unit * (glasses ? 0.65 : hat ? 1.2 : bag ? 2.5 : belt ? 0.65 : 1.6);
    const scale = Math.min(targetWidth / (frame.baseWidth * width), maxHeight / (frame.baseWidth * 1.25 * height));
    const imageWidth = frame.baseWidth * scale;
    const imageHeight = imageWidth * 1.25;
    const atSide = bag || (!glasses && !hat && !belt && !scarf);
    const centerX = atSide ? 0.5 - unit * 1.6 / frame.width : 0.5;
    const centerY = hat ? grid.upper - 0.07 * grid.fit - height * imageHeight / frame.height / 2
      : glasses ? grid.upper - 0.045 * grid.fit
      : belt ? grid.lower + 0.01 * grid.fit
      : scarf ? grid.upper + 0.025 * grid.fit
      : grid.lower + grid.height * 1.3;
    return {
      x: (centerX + (0.5 - left - width / 2) * imageWidth / frame.width) * 100,
      y: (centerY + (0.5 - top - height / 2) * imageHeight / frame.height) * 100,
      scale,
    };
  }
  const [left, , width, height] = profile.bounds;
  const measuredHeight = profile.region === "upper" ? profile.bodyHeight : height;
  const span = canvasSlotSpan(profile);
  const targetHeight = unit * span;
  let scale = targetHeight / (frame.baseWidth * 1.25 * measuredHeight);
  if (profile.region === "upper") {
    // Torso length alone can inflate a wide sweatshirt or a short-bodied coat.
    // Keep one uniform scale, with room for long and deliberately broad cuts.
    const top = garment.category === "Tops";
    const broad = /oversized|draped/i.test(garment.silhouette ?? "");
    const widthSpan = profile.slots <= 2 ? 3.1 : profile.slots <= 3 ? (top ? 3.3 : 3.6)
      : profile.slots <= 3.5 ? 3.8 : profile.slots <= 4 ? 4.2 : 4.6;
    scale = Math.min(scale, unit * (widthSpan + (broad ? 0.25 : 0)) / (frame.baseWidth * width));
  }
  const imageWidth = frame.baseWidth * scale;
  const imageHeight = imageWidth * 1.25;
  const anchor = profile.region === "lower" ? grid.lower
    : profile.region === "feet" ? grid.footBaseline - grid.height * span : grid.upper;
  return {
    x: 50 + ((0.5 - left - width / 2) * imageWidth / frame.width) * 100,
    y: (anchor + (0.5 - layoutAnchorY(profile)) * imageHeight / frame.height) * 100,
    scale,
  };
}

export async function ensureGarmentLayout(garment: Garment): Promise<void> {
  if (typeof document === "undefined") return;
  await Promise.all([garment.anatomy?.closed ? undefined : garment.image, garment.anatomy?.open ? undefined : garment.openImage].filter((source): source is string => Boolean(source)).map(source => {
    if (measured.has(source)) return Promise.resolve();
    if (pending.has(source)) return pending.get(source)!;
    const task = (async () => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = source;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("No se pudo medir la prenda.");
      context.drawImage(img, 0, 0);
      const geometry = measureGarmentAlpha(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { wideNeck: garment.neckline === "wide-hood" });
      measured.set(source, classifyGarmentLayout(garment, geometry));
    })();
    pending.set(source, task);
    return task.finally(() => pending.delete(source));
  }));
  const closed = garment.anatomy?.closed ?? measured.get(garment.image);
  const open = garment.openImage ? measured.get(garment.openImage) : undefined;
  if (closed && open && garment.openImage) {
    measured.set(garment.openImage, matchOpenLayout(closed, open));
  }
}
