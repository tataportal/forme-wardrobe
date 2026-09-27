export type CanvasItem = {
  instanceId: string; garmentId: string; variant: "closed" | "open";
  x: number; y: number; scale: number; rotation: number; z: number;
};
export type CanvasDocument = { items: CanvasItem[]; id: string | null; name: string };

// A look is the whole composition. Selection and viewport never change its content.
export function snapshotLook(items: CanvasItem[]): CanvasItem[] {
  return items.map(item => ({ ...item }));
}

export function sameDocument(a: CanvasDocument, b: CanvasDocument): boolean {
  return a.id === b.id && a.name === b.name && JSON.stringify(a.items) === JSON.stringify(b.items);
}

export function readCanvasDraft(value: unknown): CanvasDocument | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as CanvasDocument;
  if (typeof draft.name !== "string" || (draft.id !== null && typeof draft.id !== "string") || !Array.isArray(draft.items)) return null;
  const ids = new Set<string>();
  for (const item of draft.items) {
    if (!item || typeof item.instanceId !== "string" || typeof item.garmentId !== "string" || ids.has(item.instanceId)) return null;
    if (!["open", "closed"].includes(item.variant) || ![item.x, item.y, item.scale, item.rotation, item.z].every(Number.isFinite) || item.scale <= 0) return null;
    ids.add(item.instanceId);
  }
  return { id: draft.id, name: draft.name, items: snapshotLook(draft.items) };
}

export class CanvasHistory {
  past: CanvasDocument[] = [];
  future: CanvasDocument[] = [];
  checkpoint(document: CanvasDocument) {
    if (!this.past.length || !sameDocument(this.past[this.past.length - 1], document)) {
      this.past.push({ ...document, items: snapshotLook(document.items) });
      this.past = this.past.slice(-50);
    }
    this.future = [];
  }
  undo(current: CanvasDocument): CanvasDocument | null {
    while (this.past.length && sameDocument(this.past[this.past.length - 1], current)) this.past.pop();
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push({ ...current, items: snapshotLook(current.items) });
    return previous;
  }
  redo(current: CanvasDocument): CanvasDocument | null {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push({ ...current, items: snapshotLook(current.items) });
    return next;
  }
}
