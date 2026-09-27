// Image-space measurements, never physical garment sizes. Shared by the Worker
// and Canvas; no browser APIs or static catalogue are imported here.
export type AlphaGeometry = {
  bounds: [number, number, number, number];
  shoulderY: number;
  hemY: number;
  neckRise: number;
  sleeveBottoms: [number, number];
  bodyHeight: number;
};
export type GarmentLayout = AlphaGeometry & {
  slots: number;
  region: "upper" | "lower" | "full" | "feet" | "accessory";
};
export type GarmentMeasurements = GarmentLayout & {
  bodyLength: string;
  neckline: string;
  sleeveLength: string;
  confidence: number;
  measuredAt: string;
  source: "visual-qa+alpha";
};
export type GarmentAnatomy = {
  version: 1;
  closed: GarmentMeasurements | null;
  open: GarmentMeasurements | null;
};
type StoredVariant = { imageKey: string; measurement: GarmentMeasurements };
export type StoredGarmentAnatomy = { version: 1; closed: StoredVariant | null; open: StoredVariant | null };
export type AnatomyPoint = { x: number; y: number };
export type VisualAnatomy = {
  region: GarmentLayout["region"];
  body_length: string;
  neckline: string;
  sleeve_length: string;
  confidence: number;
  left_shoulder: AnatomyPoint | null;
  right_shoulder: AnatomyPoint | null;
  body_hem: AnatomyPoint | null;
  left_cuff: AnatomyPoint | null;
  right_cuff: AnatomyPoint | null;
};

// The model classifies visible body length; deterministic code assigns slots.
// Sleeves and collars are deliberately absent from this table.
export const slotsByRegion: Record<GarmentLayout["region"], Record<string, number>> = {
  upper: { cropped: 2, regular: 3, hip: 3.5, long: 4, maxi: 5 },
  lower: { short: 1.5, mini: 2, regular: 2.5, midi: 3, full: 3.5, maxi: 3.5 },
  full: { mini: 4, midi: 5.5, full: 6.5, maxi: 6.5 },
  feet: { standard: 1, boot: 1.5, tall: 2.5 },
  accessory: { standard: 1 },
};
const necklines = ["none", "standard", "high", "hood", "wide-hood"];
const sleeves = ["none", "short", "three-quarter", "long", "extra-long"];
const nullablePointSchema = {
  anyOf: [
    { type: "object", additionalProperties: false, properties: {
      x: { type: "integer", minimum: 0, maximum: 1000, description: "Horizontal position over the WHOLE output image: 0=left edge, 1000=right edge. Not pixels or garment-relative coordinates." },
      y: { type: "integer", minimum: 0, maximum: 1000, description: "Vertical position over the WHOLE output image: 0=top edge, 1000=bottom edge. Not pixels or garment-relative coordinates." },
    }, required: ["x", "y"] },
    { type: "null" },
  ],
};
export const anatomySchema = {
  type: "object", additionalProperties: false,
  properties: {
    region: { type: "string", enum: Object.keys(slotsByRegion) },
    body_length: { type: "string", enum: [...new Set(Object.values(slotsByRegion).flatMap(Object.keys))] },
    neckline: { type: "string", enum: necklines },
    sleeve_length: { type: "string", enum: sleeves },
    confidence: { type: "integer", minimum: 0, maximum: 100, description: "Anatomical measurement confidence as a percentage, 0 to 100. For 90% return 90, NOT 9 or 0.9. Below 80 triggers remeasurement." },
    left_shoulder: nullablePointSchema, right_shoulder: nullablePointSchema,
    body_hem: nullablePointSchema, left_cuff: nullablePointSchema, right_cuff: nullablePointSchema,
  },
  required: ["region", "body_length", "neckline", "sleeve_length", "confidence", "left_shoulder", "right_shoulder", "body_hem", "left_cuff", "right_cuff"],
};
export const anatomyInstruction = `Also measure anatomy on the OUTPUT, not the source photo. Coordinates are integers 0..1000 over the whole OUTPUT. Classify what is visible, independently of its name. For upper garments mark left/right upper shoulder contour beside the neck (not a dropped sleeve seam, hood top or collar top), one point on the actual torso hem (not a sleeve, drawstring or inner lining), and both sleeve cuff ends. Keep the full high collar/hood above the shoulders; long sleeves below a cropped torso do NOT make its body long. With an open front choose a hem point on a real front panel. Use neckline none/standard/high/hood/wide-hood and sleeve_length none/short/three-quarter/long/extra-long. Null cuffs only for sleeveless garments; non-upper garments may use null landmarks. Region and body_length pairs: upper=cropped/regular/hip/long/maxi; lower=short/mini/regular/midi/full/maxi; full (dress or jumpsuit)=mini/midi/full/maxi; feet=standard/boot/tall; accessory=standard. Body length describes where the body hem would fall when worn, NOT total silhouette height including neck and sleeves. Confidence is anatomy confidence only: low confidence must not fail an otherwise faithful image.`;

export class InvalidAnatomyError extends Error {
  constructor(message: string, public readonly contourGuide = "", public readonly candidates: AnatomyCandidate[] = []) { super(message); this.name = "InvalidAnatomyError"; }
}

export type AnatomyCandidate = AnatomyPoint & { id: string; edge: "top" | "bottom" };

// Give a failed visual measurement a calibrated coordinate reference. These
// are actual alpha edges, not guessed anatomy; the model still identifies
// shoulders, torso hem and cuffs independently. Never repair confidence by
// multiplying it or widen the edge tolerance to accept points in empty space.
export function anatomyCandidates(data: ArrayLike<number>, width: number, height: number): AnatomyCandidate[] {
  const points: AnatomyCandidate[] = [];
  for (let normalizedX = 25; normalizedX < 1000; normalizedX += 25) {
    const x = Math.round(normalizedX * (width - 1) / 1000);
    let top = -1, bottom = -1;
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4 + 3] >= 24) {
      if (top < 0) top = y;
      bottom = y;
    }
    if (top >= 0) points.push(
      { id: `T${normalizedX}`, edge: "top", x: normalizedX, y: Math.round(top / height * 1000) },
      { id: `B${normalizedX}`, edge: "bottom", x: normalizedX, y: Math.round((bottom + 1) / height * 1000) },
    );
  }
  return points;
}

export function anatomyContourGuide(data: ArrayLike<number>, width: number, height: number): string {
  return `OUTPUT calibration: ${width}x${height} pixels. Coordinates are already normalized 0..1000 over the WHOLE image. Actual silhouette candidates: ${JSON.stringify(anatomyCandidates(data, width, height))}. Choose candidate IDs, NEVER convert or recalculate coordinates. T=top edge, B=bottom edge. Shoulders lie beside the neck; torso hem lies on torso panels; cuffs lie on sleeves. Confidence MUST be a percentage 0..100 (90 means 90%, never 9).`;
}

const landmarkEdges = { left_shoulder: "top", right_shoulder: "top", body_hem: "bottom", left_cuff: "bottom", right_cuff: "bottom" } as const;
export function anatomySelectionSchema(candidates: AnatomyCandidate[]) {
  const properties: Record<string, unknown> = { ...anatomySchema.properties };
  for (const [name, edge] of Object.entries(landmarkEdges)) {
    const ids = candidates.filter(p => p.edge === edge && (!name.startsWith("left") || p.x < 500) && (!name.startsWith("right") || p.x > 500)).map(p => p.id);
    properties[name] = ids.length ? {
      anyOf: [{ type: "string", enum: ids }, { type: "null" }],
      description: "Choose the ID of a real contour point in the supplied list. No numeric coordinates. Null only when this landmark does not apply.",
    } : { type: "null" };
  }
  return { ...anatomySchema, properties };
}

export function resolveAnatomySelection(selection: Record<string, unknown>, candidates: AnatomyCandidate[]): unknown {
  const result = { ...selection };
  for (const [name, edge] of Object.entries(landmarkEdges)) {
    if (selection[name] === null) { result[name] = null; continue; }
    const point = candidates.find(p => p.id === selection[name] && p.edge === edge);
    if (!point) throw new InvalidAnatomyError("La medición eligió un punto que no existe en el contorno.");
    result[name] = { x: point.x, y: point.y };
  }
  return result;
}

export function parseVisualAnatomy(value: unknown): VisualAnatomy | null {
  if (!value || typeof value !== "object") return null;
  const v = value as VisualAnatomy;
  if (!Object.hasOwn(slotsByRegion, v.region) || !Object.hasOwn(slotsByRegion[v.region], v.body_length)
    || !necklines.includes(v.neckline) || !sleeves.includes(v.sleeve_length)
    || !Number.isInteger(v.confidence) || v.confidence < 80 || v.confidence > 100) return null;
  const validPoint = (p: AnatomyPoint | null) => p === null || (typeof p === "object" && p !== null
    && Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.x <= 1000 && p.y >= 0 && p.y <= 1000);
  if (![v.left_shoulder, v.right_shoulder, v.body_hem, v.left_cuff, v.right_cuff].every(validPoint)) return null;
  if (v.region === "upper" && (!v.left_shoulder || !v.right_shoulder || !v.body_hem
    || v.left_shoulder.x >= v.right_shoulder.x
    || (v.sleeve_length !== "none" && (!v.left_cuff || !v.right_cuff)))) return null;
  return v;
}

export function measureCutoutAnatomy(data: ArrayLike<number>, width: number, height: number, value: unknown): GarmentMeasurements {
  const anatomy = parseVisualAnatomy(value);
  const invalid = (message: string) => new InvalidAnatomyError(message, anatomyContourGuide(data, width, height), anatomyCandidates(data, width, height));
  if (!anatomy) throw invalid("La anatomía no tiene suficiente confianza porcentual (mínimo 80 de 100) o faltan puntos de referencia.");
  let left = width, top = height, right = -1, bottom = -1;
  const visible = (x: number, y: number) => x >= 0 && x < width && y >= 0 && y < height && data[(y * width + x) * 4 + 3] >= 24;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!visible(x, y)) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right < left || bottom < top) throw new InvalidAnatomyError("El calado no tiene una silueta medible.");
  // Snap the model's landmarks to nearby real alpha edges; never invent/crop pixels.
  const edgeY = (point: AnatomyPoint, edge: "top" | "bottom") => {
    const px = point.x * width / 1000, py = point.y * height / 1000;
    const rx = Math.max(2, Math.ceil(width * 0.025)), ry = Math.max(2, Math.ceil(height * 0.035));
    let best = Infinity, result: number | null = null;
    for (let y = Math.max(top, Math.floor(py - ry)); y <= Math.min(bottom, Math.ceil(py + ry)); y++) {
      for (let x = Math.max(left, Math.floor(px - rx)); x <= Math.min(right, Math.ceil(px + rx)); x++) {
        if (!visible(x, y) || visible(x, y + (edge === "top" ? -1 : 1))) continue;
        const distance = ((x - px) / width) ** 2 + ((y - py) / height) ** 2;
        if (distance < best) { best = distance; result = (y + (edge === "bottom" ? 1 : 0)) / height; }
      }
    }
    if (result === null) throw invalid(`El punto (${point.x}, ${point.y}) no coincide con el contorno real ${edge} del calado.`);
    return result;
  };
  const bounds: AlphaGeometry["bounds"] = [left / width, top / height, (right - left + 1) / width, (bottom - top + 1) / height];
  const upper = anatomy.region === "upper";
  const shoulderY = upper ? (edgeY(anatomy.left_shoulder!, "top") + edgeY(anatomy.right_shoulder!, "top")) / 2 : bounds[1];
  const hemY = upper ? edgeY(anatomy.body_hem!, "bottom") : bounds[1] + bounds[3];
  const sleeveBottoms: [number, number] = upper && anatomy.sleeve_length !== "none"
    ? [edgeY(anatomy.left_cuff!, "bottom"), edgeY(anatomy.right_cuff!, "bottom")] : [hemY, hemY];
  if (upper && (hemY - shoulderY < 0.08 || shoulderY > bounds[1] + bounds[3] * 0.45 || sleeveBottoms.some(y => y <= shoulderY))) {
    throw invalid("Las medidas de cuerpo, cuello o mangas son inconsistentes.");
  }
  return {
    bounds, shoulderY, hemY, neckRise: shoulderY - bounds[1], sleeveBottoms, bodyHeight: hemY - shoulderY,
    region: anatomy.region, slots: slotsByRegion[anatomy.region][anatomy.body_length],
    bodyLength: anatomy.body_length, neckline: anatomy.neckline, sleeveLength: anatomy.sleeve_length,
    confidence: anatomy.confidence, source: "visual-qa+alpha", measuredAt: new Date().toISOString(),
  };
}

export function readStoredAnatomy(raw: string | null | undefined, imageKey: string | null, openImageKey: string | null): StoredGarmentAnatomy {
  const empty: StoredGarmentAnatomy = { version: 1, closed: null, open: null };
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw) as StoredGarmentAnatomy;
    if (parsed.version !== 1) return empty;
    const valid = (variant: StoredVariant | null, key: string | null) => {
      const p = variant?.measurement;
      return key && variant?.imageKey === key && p?.source === "visual-qa+alpha"
        && p.slots > 0 && p.slots <= 7 && p.bodyHeight > 0 && p.bounds?.length === 4
        && [...p.bounds, p.shoulderY, p.hemY, p.neckRise, ...p.sleeveBottoms].every(Number.isFinite)
        ? variant : null;
    };
    return { version: 1, closed: valid(parsed.closed, imageKey), open: valid(parsed.open, openImageKey) };
  } catch { return empty; }
}

export function publicGarmentAnatomy(raw: string | null | undefined, imageKey: string | null, openImageKey: string | null): GarmentAnatomy | null {
  const stored = readStoredAnatomy(raw, imageKey, openImageKey);
  return stored.closed || stored.open ? { version: 1, closed: stored.closed?.measurement ?? null, open: stored.open?.measurement ?? null } : null;
}
