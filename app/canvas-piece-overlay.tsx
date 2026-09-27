"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { fitCanvasOverlay, visibleGarmentBounds, type OverlayRect } from "./canvas-overlay-bounds";

export function CanvasPieceOverlay({ instanceId, geometryKey, selected, children }: {
  instanceId: string; geometryKey: string; selected: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ box: OverlayRect; outline: OverlayRect } | null>(null);
  const box = layout?.box;
  const [touchTools, setTouchTools] = useState(false);

  useLayoutEffect(() => {
    const artboard = ref.current?.parentElement;
    const canvas = artboard?.closest<HTMLElement>(".look-canvas");
    const piece = Array.from(artboard?.querySelectorAll<HTMLElement>(".canvas-piece") ?? [])
      .find(element => element.dataset.instanceId === instanceId);
    if (!artboard || !canvas || !piece) return;
    const media = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");
    const measure = () => {
      setTouchTools(media.matches);
      const origin = artboard.getBoundingClientRect();
      const bounds = canvas.getBoundingClientRect();
      const garment = piece.getBoundingClientRect();
      const area = { left: bounds.left - origin.left, top: bounds.top - origin.top, width: bounds.width, height: bounds.height };
      const visible = visibleGarmentBounds(garment, { width: piece.offsetWidth, height: piece.offsetHeight },
        (piece.dataset.alphaBounds ?? "").split(",").map(Number), new DOMMatrixReadOnly(getComputedStyle(piece).transform));
      const selection = { ...visible, left: visible.left - origin.left, top: visible.top - origin.top };
      const box = fitCanvasOverlay(selection, area, media.matches);
      const left = Math.max(area.left + 1, selection.left), top = Math.max(area.top + 1, selection.top);
      const outline = { left: left - box.left, top: top - box.top,
        width: Math.max(0, Math.min(area.left + area.width - 1, selection.left + selection.width) - left),
        height: Math.max(0, Math.min(area.top + area.height - 1, selection.top + selection.height) - top) };
      setLayout(previous => previous && JSON.stringify(previous) === JSON.stringify({ box, outline }) ? previous : { box, outline });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(piece);
    window.addEventListener("resize", measure);
    media.addEventListener("change", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); media.removeEventListener("change", measure); };
  }, [instanceId, geometryKey, selected]);

  return <div ref={ref} className={`canvas-piece-ui ${selected ? "selected" : ""} ${box && box.height < 144 ? "compact-tools" : ""} ${touchTools ? "touch-tools" : ""}`} style={{
    ...box,
    visibility: box ? "visible" : "hidden",
    zIndex: selected ? 9001 : 9000,
    transform: "none",
    aspectRatio: "auto",
    "--piece-outline-width": "1.5px",
    "--selection-left": `${layout?.outline.left ?? 0}px`,
    "--selection-top": `${layout?.outline.top ?? 0}px`,
    "--selection-width": `${layout?.outline.width ?? 0}px`,
    "--selection-height": `${layout?.outline.height ?? 0}px`,
  } as CSSProperties} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>{children}</div>;
}
