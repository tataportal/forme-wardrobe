type Layer = { instanceId: string; z: number };

export function moveCanvasLayer<T extends Layer>(pieces: T[], instanceId: string, direction: "up" | "down"): T[] {
  const ordered = [...pieces].sort((a, b) => a.z - b.z);
  const index = ordered.findIndex(piece => piece.instanceId === instanceId);
  const target = index + (direction === "up" ? 1 : -1);
  if (index < 0 || target < 0 || target >= ordered.length) return pieces;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  // Unique, bounded stacking values also resolve ties in older saved looks.
  const ranks = new Map(ordered.map((piece, rank) => [piece.instanceId, rank + 1]));
  return pieces.map(piece => ({ ...piece, z: ranks.get(piece.instanceId)! }));
}
