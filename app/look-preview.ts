type PreviewPiece = { x: number; y: number; scale: number; rotation: number };
export type PreviewBounds = readonly [number, number, number, number];
const frame = { width: 1000, height: 1500, imageWidth: 760, imageHeight: 950 };

// Fit the visible silhouettes as ONE group. This is a presentation transform;
// callers keep the original document for editing, saving and history.
export function fitLookPreview<T extends PreviewPiece>(items: readonly T[], boundsFor: (item: T) => PreviewBounds | undefined): T[] {
  if (!items.length) return [];
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const item of items) {
    if (![item.x, item.y, item.scale, item.rotation].every(Number.isFinite) || item.scale <= 0) return items.map(piece => ({ ...piece }));
    const bounds = boundsFor(item) ?? [0.1, 0.08, 0.8, 0.84];
    const [bx, by, bw, bh] = bounds;
    const angle = item.rotation * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    for (const u of [bx, bx + bw]) for (const v of [by, by + bh]) {
      const dx = (u - 0.5) * frame.imageWidth * item.scale;
      const dy = (v - 0.5) * frame.imageHeight * item.scale;
      const x = item.x * frame.width / 100 + dx * cos - dy * sin;
      const y = item.y * frame.height / 100 + dx * sin + dy * cos;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  // The same physical inset on all sides of the 2:3 thumbnail.
  const margin = 60;
  const ratio = Math.min((frame.width - 2 * margin) / (right - left), (frame.height - 2 * margin) / (bottom - top));
  if (!Number.isFinite(ratio) || ratio <= 0) return items.map(piece => ({ ...piece }));
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  return items.map(item => ({ ...item,
    x: 50 + (item.x * frame.width / 100 - cx) * ratio / frame.width * 100,
    y: 50 + (item.y * frame.height / 100 - cy) * ratio / frame.height * 100,
    scale: item.scale * ratio,
  }));
}
