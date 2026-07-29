export type NormalizedMaskPoint = {
  x: number;
  y: number;
};

export type PixelMaskPoint = {
  x: number;
  y: number;
};

export type GarmentBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type OpeningSpan = {
  y: number;
  start: number;
  end: number;
};

export type InteriorOpeningPlan = {
  passed: boolean;
  notes: string;
  spans: OpeningSpan[];
  topWidthRatio: number;
  maxWidthRatio: number;
};

export function pixelMaskPolygon(
  points: NormalizedMaskPoint[],
  width: number,
  height: number,
): PixelMaskPoint[] | null {
  if (points.length < 8 || points.length > 24) return null;
  const normalized = points.map(({ x, y }) => ({
    x: Number(x),
    y: Math.max(120, Number(y)),
  }));
  if (normalized.some(({ x, y }) => (
    !Number.isFinite(x)
    || !Number.isFinite(y)
    || x < 0
    || x > 1000
    || y < 0
    || y > 1000
  ))) return null;

  const xs = normalized.map(({ x }) => x);
  const ys = normalized.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let twiceArea = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[(index + 1) % normalized.length];
    twiceArea += current.x * next.y - next.x * current.y;
  }
  const area = Math.abs(twiceArea) / 2;
  const preservesBackCollar = minY >= 120;
  const reachesHem = maxY >= 700;
  const crossesCenter = minX < 520 && maxX > 480;
  const plausibleArea = area >= 4_000 && area <= 260_000;
  if (!preservesBackCollar || !reachesHem || !crossesCenter || !plausibleArea) return null;

  return normalized.map(({ x, y }) => ({
    x: x / 1000 * (width - 1),
    y: y / 1000 * (height - 1),
  }));
}

function scanlinePairs(
  polygon: PixelMaskPoint[],
  y: number,
): Array<{ start: number; end: number }> {
  const scanY = y + 0.5;
  const intersections: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    if ((current.y <= scanY && next.y > scanY) || (next.y <= scanY && current.y > scanY)) {
      intersections.push(current.x + (scanY - current.y) * (next.x - current.x) / (next.y - current.y));
    }
  }
  intersections.sort((left, right) => left - right);
  const pairs: Array<{ start: number; end: number }> = [];
  for (let index = 0; index + 1 < intersections.length; index += 2) {
    pairs.push({ start: intersections[index], end: intersections[index + 1] });
  }
  return pairs;
}

export function planInteriorOpening(
  polygon: PixelMaskPoint[],
  imageWidth: number,
  imageHeight: number,
  bounds: GarmentBounds,
): InteriorOpeningPlan {
  const fail = (notes: string, spans: OpeningSpan[] = []): InteriorOpeningPlan => ({
    passed: false,
    notes,
    spans,
    topWidthRatio: 0,
    maxWidthRatio: 0,
  });
  const garmentWidth = bounds.maxX - bounds.minX + 1;
  const garmentHeight = bounds.maxY - bounds.minY + 1;
  if (
    polygon.length < 8
    || garmentWidth <= 0
    || garmentHeight <= 0
    || imageWidth <= 0
    || imageHeight <= 0
  ) return fail("La abertura propuesta no contiene un contorno interior utilizable.");

  const garmentCenter = (bounds.minX + bounds.maxX) / 2;
  const collarGuardY = bounds.minY + garmentHeight * 0.06;
  const requiredBottomY = bounds.maxY - garmentHeight * 0.035;
  const polygonMinY = Math.max(0, Math.floor(Math.min(...polygon.map(({ y }) => y))));
  const polygonMaxY = Math.min(imageHeight - 1, Math.ceil(Math.max(...polygon.map(({ y }) => y))));
  const firstY = Math.max(Math.ceil(collarGuardY), polygonMinY);
  const lastY = Math.min(bounds.maxY, polygonMaxY);
  const baseInset = Math.max(5, Math.round(garmentWidth * 0.009));
  const collarInset = Math.max(4, Math.round(garmentWidth * 0.014));
  const spans: OpeningSpan[] = [];
  let maximumCenterDrift = 0;
  let maxWidthRatio = 0;

  for (let y = firstY; y <= lastY; y += 1) {
    const candidates = scanlinePairs(polygon, y)
      .filter(({ start, end }) => end > start)
      .sort((left, right) => (
        Math.abs((left.start + left.end) / 2 - garmentCenter)
        - Math.abs((right.start + right.end) / 2 - garmentCenter)
      ));
    const candidate = candidates[0];
    if (!candidate) continue;

    const rawCenter = (candidate.start + candidate.end) / 2;
    const centerDrift = Math.abs(rawCenter - garmentCenter) / garmentWidth;
    maximumCenterDrift = Math.max(maximumCenterDrift, centerDrift);
    const collarProgress = Math.max(0, Math.min(1, (y - collarGuardY) / (garmentHeight * 0.22)));
    const safetyInset = baseInset + Math.round((1 - collarProgress) * collarInset);
    const start = Math.max(bounds.minX, Math.ceil(candidate.start + safetyInset));
    const end = Math.min(bounds.maxX, Math.floor(candidate.end - safetyInset));
    if (end - start < Math.max(4, garmentWidth * 0.012)) continue;

    const widthRatio = (end - start + 1) / garmentWidth;
    maxWidthRatio = Math.max(maxWidthRatio, widthRatio);
    spans.push({ y, start, end });
  }

  if (spans.length < garmentHeight * 0.40) {
    return fail("La abertura interior no recorre suficiente altura de la prenda.", spans);
  }
  const topBandEnd = spans[0].y + garmentHeight * 0.08;
  const topSpans = spans.filter(({ y }) => y <= topBandEnd);
  const topWidthRatio = topSpans.length
    ? Math.max(...topSpans.map(({ start, end }) => (end - start + 1) / garmentWidth))
    : 0;
  const bottomY = spans[spans.length - 1].y;
  if (bottomY < requiredBottomY) {
    return {
      passed: false,
      notes: "La abertura propuesta no llega al ruedo siguiendo los paneles interiores.",
      spans,
      topWidthRatio,
      maxWidthRatio,
    };
  }
  if (maximumCenterDrift > 0.10) {
    return {
      passed: false,
      notes: "La abertura propuesta se desvía del centro y podría cortar un panel exterior.",
      spans,
      topWidthRatio,
      maxWidthRatio,
    };
  }
  if (topWidthRatio > 0.22 || maxWidthRatio > 0.30) {
    return {
      passed: false,
      notes: "La abertura propuesta es demasiado ancha y podría comerse cuello, solapas o gráficos.",
      spans,
      topWidthRatio,
      maxWidthRatio,
    };
  }

  return {
    passed: true,
    notes: "La máscara sigue el contorno interior con margen de seguridad para cuello y paneles.",
    spans,
    topWidthRatio,
    maxWidthRatio,
  };
}
