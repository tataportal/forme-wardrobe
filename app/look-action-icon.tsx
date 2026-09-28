const paths = {
  new: "M12 5v14M5 12h14",
  mix: "M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3.5-2 5-5m2-2c1.5-3 3-5 5-5h3m-4-4 4 4-4 4",
  undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 7v4",
  redo: "m16 4 5 5-5 5m5-5H11a7 7 0 0 0-7 7v4",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8Z",
  copy: "M8 8h12v12H8ZM16 8V4H4v12h4",
  share: "M12 15V3m-4 4 4-4 4 4M5 12v8h14v-8",
  clear: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  save: "M5 3h12l4 4v14H3V3Zm2 0v6h10V3M7 21v-8h10v8",
  layers: "m12 3 8 4-8 4-8-4 8-4Zm8 9-8 4-8-4m16 5-8 4-8-4",
  looks: "M5 4h14v16H5zM9 4v16m6-16v16",
} as const;

export function LookActionIcon({ action }: { action: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={paths[action]} /></svg>;
}
