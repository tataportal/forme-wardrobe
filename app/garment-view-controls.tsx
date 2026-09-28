"use client";

import { useEffect, useState } from "react";
import { FormeMenu } from "./forme-menu";

type GridSize = "small" | "medium" | "large";
const sizes: Array<{ value: GridSize; label: string }> = [
  { value: "small", label: "Pequeñas" },
  { value: "medium", label: "Medianas" },
  { value: "large", label: "Grandes" },
];

export function useGarmentGridSize(area: "closet" | "canvas") {
  const [size, setSize] = useState<GridSize>("medium");
  const key = `forme-${area}-grid-size-v1`;
  useEffect(() => {
    let frame = 0;
    try {
      const stored = localStorage.getItem(key);
      if (sizes.some(option => option.value === stored)) frame = requestAnimationFrame(() => setSize(stored as GridSize));
    } catch { /* Grid controls also work without browser storage. */ }
    return () => cancelAnimationFrame(frame);
  }, [key]);
  const updateSize = (next: GridSize) => {
    setSize(next);
    try { localStorage.setItem(key, next); } catch { /* Keep the choice for this visit. */ }
  };
  return [size, updateSize] as const;
}

export function GarmentViewControls({ size, onSizeChange, favorites, onFavoritesChange, compact = false }: {
  size: GridSize;
  onSizeChange: (size: GridSize) => void;
  favorites: boolean;
  onFavoritesChange: (selected: boolean) => void;
  compact?: boolean;
}) {
  return <div className={`garment-view-controls${compact ? " compact" : ""}`} role="group" aria-label="Vista de prendas">
    <button className="favorites-toggle" type="button" aria-label="Favoritas" title="Favoritas" aria-pressed={favorites} onClick={() => onFavoritesChange(!favorites)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>
      <span>Favoritas</span>
    </button>
    <FormeMenu label="Tamaño de miniaturas" trigger={<span className="grid-view-icon" aria-hidden="true"><i /><i /><i /><i /></span>}>
      <span className="grid-size-heading">Miniaturas</span>
      {sizes.map(option => <button key={option.value} type="button" aria-pressed={size === option.value} onClick={() => onSizeChange(option.value)}>{option.label}<span aria-hidden="true">{size === option.value ? "✓" : ""}</span></button>)}
    </FormeMenu>
  </div>;
}
