import type { Garment } from "./garments";
import { accessoryKind } from "../shared/garment-proportions";
import { garmentLayout } from "./garment-layout";

type Piece = { instanceId: string; garmentId: string };

function role(garment: Garment): string {
  if (garmentLayout(garment).region === "full") return "full";
  if (garment.category === "Outerwear" || garment.category === "Tailoring") return "outer";
  if (garment.category === "Accessories") return `accessory:${accessoryKind(garment)}`;
  return garment.category;
}

export function availableMixGarments(garments: Garment[], includeFormeBasics = true): Garment[] {
  return garments.filter(garment => (includeFormeBasics || garment.collection !== "forme") && garment.image && garment.qaStatus !== "review" && ["ready", "ghosted"].includes(garment.status));
}

export function randomLookGarments(garments: Garment[], random = Math.random, includeFormeBasics = true): Garment[] {
  const ready = availableMixGarments(garments, includeFormeBasics);
  const pick = (candidates: Garment[]) => candidates.length
    ? candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))]
    : undefined;
  // Start with one base: a top and bottom, or a full-body garment. Add only
  // one outer layer, pair of shoes and accessory from the available closet.
  const base = pick(ready.filter(garment => role(garment) === "Tops" || role(garment) === "full"));
  const bottom = base && role(base) === "full" ? undefined : pick(ready.filter(garment => role(garment) === "Bottoms"));
  return [
    bottom,
    base,
    pick(ready.filter(garment => role(garment) === "outer")),
    pick(ready.filter(garment => role(garment) === "Footwear")),
    pick(ready.filter(garment => role(garment).startsWith("accessory:"))),
  ].filter((garment): garment is Garment => Boolean(garment));
}

export function randomGarmentReplacements(
  garments: Garment[], current: Piece[], locked: ReadonlySet<string>, random = Math.random, includeFormeBasics = true,
): Map<string, Garment> {
  const byId = new Map(garments.map(garment => [garment.id, garment]));
  const ready = availableMixGarments(garments, includeFormeBasics);
  const occupied = new Set(current.filter(piece => locked.has(piece.instanceId)).map(piece => piece.garmentId));
  const replacements = new Map<string, Garment>();
  // Keep the same roles and number of pieces. Bags stay bags, glasses stay
  // glasses; tops and trousers are NOT implicitly locked. Every eligible item
  // can be selected, not just a fixed set of five styling recipes.
  for (const piece of current) {
    if (locked.has(piece.instanceId)) continue;
    const previous = byId.get(piece.garmentId);
    if (!previous) continue;
    const candidates = ready.filter(garment => garment.id !== previous.id && !occupied.has(garment.id) && role(garment) === role(previous));
    if (!candidates.length) { occupied.add(previous.id); continue; }
    const choice = candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(random() * candidates.length)))];
    occupied.add(choice.id);
    replacements.set(piece.instanceId, choice);
  }
  return replacements;
}
