export type OverlayRect = { left: number; top: number; width: number; height: number };

// Follow the visible cutout, including rotation, instead of its transparent padding.
export function visibleGarmentBounds(rect: OverlayRect, size: { width: number; height: number },
  alpha: number[], matrix: { a: number; b: number; c: number; d: number }): OverlayRect {
  if (alpha.length !== 4 || alpha.some(value => !Number.isFinite(value)) || alpha[2] <= 0 || alpha[3] <= 0) return rect;
  const [left, top, width, height] = alpha;
  const corners = [[left, top], [left + width, top], [left, top + height], [left + width, top + height]]
    .map(([x, y]) => {
      const dx = (x - .5) * size.width, dy = (y - .5) * size.height;
      return { x: rect.left + rect.width / 2 + matrix.a * dx + matrix.c * dy,
        y: rect.top + rect.height / 2 + matrix.b * dx + matrix.d * dy };
    });
  const x = Math.min(...corners.map(point => point.x)), y = Math.min(...corners.map(point => point.y));
  return { left: x, top: y, width: Math.max(...corners.map(point => point.x)) - x, height: Math.max(...corners.map(point => point.y)) - y };
}

// Reserve 44px touch targets around the outline, also at the canvas edges.
export function fitCanvasOverlay(piece: OverlayRect, area: OverlayRect, touchTools = false): OverlayRect {
  const inset = 30;
  const availableWidth = Math.max(0, area.width - inset * 2);
  const availableHeight = Math.max(0, area.height - inset * 2);
  const compact = !touchTools && availableHeight < 144;
  const left = area.left + inset, top = area.top + inset;
  const right = left + availableWidth, bottom = top + availableHeight;
  const visibleLeft = Math.max(left, piece.left), visibleTop = Math.max(top, piece.top);
  const visibleWidth = Math.max(0, Math.min(right, piece.left + piece.width) - visibleLeft);
  const visibleHeight = Math.max(0, Math.min(bottom, piece.top + piece.height) - visibleTop);
  const width = Math.min(Math.max(compact ? 144 : 104, visibleWidth), availableWidth);
  const height = Math.min(Math.max(touchTools || compact ? 52 : 144, visibleHeight), availableHeight);
  return {
    left: Math.max(left, Math.min(visibleLeft - (width - visibleWidth) / 2, right - width)),
    top: Math.max(top, Math.min(visibleTop - (height - visibleHeight) / 2, bottom - height)),
    width, height,
  };
}
