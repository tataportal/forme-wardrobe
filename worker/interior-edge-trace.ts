import type { GarmentBounds, OpeningSpan } from "./layering-mask";

// Refine the vision proposal using the image's actual seams. A reliable,
// exterior-connected hem gap supplies the bottom anchors; dynamic programming
// follows continuous image edges, instead of cutting along polygon diagonals.
// If that evidence is absent, leave the proposal to the existing strict QA.
export function traceInteriorEdges(data: Uint8ClampedArray, width: number, height: number, proposal: OpeningSpan[], bounds: GarmentBounds): OpeningSpan[] | null {
  if (proposal.length < 2) return null;
  const center = Math.round((bounds.minX + bounds.maxX) / 2);
  const garmentWidth = bounds.maxX - bounds.minX + 1;
  const garmentHeight = bounds.maxY - bounds.minY + 1;
  const visible = (x: number, y: number) => data[(y * width + x) * 4 + 3] >= 24;
  const gaps: Array<{ y: number; left: number; right: number }> = [];
  for (let y = Math.floor(bounds.maxY - garmentHeight * 0.07); y <= bounds.maxY; y++) {
    if (visible(center, y)) continue;
    let left = center, right = center;
    while (left > bounds.minX && !visible(left, y)) left--;
    while (right < bounds.maxX && !visible(right, y)) right++;
    if (left > bounds.minX + garmentWidth * 0.2 && right < bounds.maxX - garmentWidth * 0.2
      && right - left > garmentWidth * 0.02 && right - left < garmentWidth * 0.25) gaps.push({ y, left, right });
  }
  if (gaps.length < 5) return null;
  // Avoid the last anti-aliased hem row, where a few pixels could falsely widen
  // the gap into fabric. The first stable run lies above those tapering pixels.
  const run = gaps.slice(0, Math.min(8, gaps.length));
  if (run.at(-1)!.y - run[0].y > run.length + 2) return null;
  const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const bottomLeft = median(run.map(p => p.left)), bottomRight = median(run.map(p => p.right));
  if (run.some(p => Math.abs(p.left - bottomLeft) > garmentWidth * 0.025 || Math.abs(p.right - bottomRight) > garmentWidth * 0.025)) return null;
  const top = proposal[0].y, bottom = gaps.at(-1)!.y;
  if (bottom - top < garmentHeight * 0.4) return null;
  const step = Math.max(2, Math.round(height / 320));
  const rows = Array.from({ length: Math.ceil((bottom - top) / step) + 1 }, (_, i) => Math.min(bottom, top + i * step));
  const light = (x: number, y: number) => {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const i = ((y + dy) * width + x + dx) * 4;
      sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    return sum / 9;
  };
  const trace = (topX: number, anchor: number) => {
    const radius = Math.round(garmentWidth * 0.063);
    const min = Math.max(6, Math.floor(Math.min(topX, anchor) - radius));
    const max = Math.min(width - 7, Math.ceil(Math.max(topX, anchor) + radius));
    const count = max - min + 1, paths: Int16Array[] = [];
    let previous = new Float64Array(count);
    for (let row = 0; row < rows.length; row++) {
      const y = rows[row], progress = row / (rows.length - 1);
      const expected = topX * (1 - progress) + anchor * progress;
      const scores = new Float64Array(count), back = new Int16Array(count);
      for (let i = 0; i < count; i++) {
        const x = min + i, a = light(x - 4, y), b = light(x + 4, y);
        const contrast = Math.abs(a - b), trough = Math.max(0, (a + b) / 2 - light(x, y));
        let best = -Infinity, bestIndex = i;
        for (let j = Math.max(0, i - 3); j <= Math.min(count - 1, i + 3); j++) {
          const score = previous[j] - Math.abs(i - j) * 0.5;
          if (score > best) { best = score; bestIndex = j; }
        }
        scores[i] = best + contrast + trough * 0.5 - Math.abs(x - expected) * 0.12;
        back[i] = bestIndex;
      }
      previous = scores; paths.push(back);
    }
    let pick = anchor - min;
    const end = pick;
    for (let i = Math.max(0, end - 3); i <= Math.min(count - 1, end + 3); i++) if (previous[i] > previous[pick]) pick = i;
    const edge: number[] = [];
    for (let row = rows.length - 1; row >= 0; row--) { edge[row] = min + pick; pick = paths[row][pick]; }
    return edge;
  };
  const rawLeft = trace(proposal[0].start, bottomLeft), rawRight = trace(proposal[0].end, bottomRight);
  // A button/highlight must not attract a seam into the panel. A conservative
  // envelope over adjacent rows keeps those local protrusions on the garment.
  const radius = Math.max(2, Math.round(height * 0.025 / step));
  const left = rawLeft.map((_, i) => Math.max(...rawLeft.slice(Math.max(0, i - radius), i + radius + 1)));
  const right = rawRight.map((_, i) => Math.min(...rawRight.slice(Math.max(0, i - radius), i + radius + 1)));
  const inset = Math.max(4, Math.round(garmentWidth * 0.007));
  const spans: OpeningSpan[] = [];
  for (let i = 0; i < rows.length - 1; i++) for (let y = rows[i]; y < rows[i + 1]; y++) {
    const t = (y - rows[i]) / (rows[i + 1] - rows[i]);
    const start = Math.ceil(left[i] * (1 - t) + left[i + 1] * t + inset);
    const end = Math.floor(right[i] * (1 - t) + right[i + 1] * t - inset);
    if (start >= end || end - start > garmentWidth * 0.30 || start < bounds.minX || end > bounds.maxX) return null;
    spans.push({ y, start, end });
  }
  return spans;
}
