import type { GarmentCategory, GarmentType } from "../app/garments";
import type { GarmentLayout } from "./garment-anatomy";

// Presentation only. Physical measurements belong to a separate future model.
export const lengthOptions = {
  upper: { cropped: "Corto / cropped", regular: "Regular", hip: "A la cadera", long: "Largo", maxi: "Hasta los tobillos" },
  lower: { short: "Corto", mini: "Mini", regular: "A la rodilla", midi: "Midi", full: "Hasta los tobillos", maxi: "Hasta el suelo" },
  full: { mini: "Corto", midi: "Midi", full: "Hasta los tobillos", maxi: "Hasta el suelo" },
  feet: { standard: "Bajo", boot: "Al tobillo", tall: "Caña alta" },
  accessory: {},
} as const;
export type LengthOverride = "cropped" | "regular" | "hip" | "long" | "maxi" | "short" | "mini" | "midi" | "full" | "standard" | "boot" | "tall";
type Kind = { category: GarmentCategory; garmentType: GarmentType };
export function garmentRegion(item: Kind): GarmentLayout["region"] {
  if (item.category === "One-pieces") return "full";
  if (item.category === "Accessories") return "accessory";
  if (item.category === "Footwear") return "feet";
  if (item.category === "Bottoms") return "lower";
  return "upper";
}
export function validLengthOverride(item: Kind, value: unknown): value is LengthOverride {
  return typeof value === "string" && Object.hasOwn(lengthOptions[garmentRegion(item)], value);
}

export function accessoryKind(item: { garmentType: string; name: string }): string {
  // Stable types win over editable names; infer only for legacy generic items.
  if (item.garmentType !== "Accessory") return item.garmentType;
  const name = item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/belt|cinturon/.test(name)) return "Belt";
  if (/scarf|panuelo|bufanda/.test(name)) return "Scarf";
  if (/glasses|lentes|gafas/.test(name)) return "Glasses";
  if (/\bbag\b|tote|bolso|handbag|mochila/.test(name)) return "Bag";
  if (/\bhat\b|\bcap\b|beanie|gorr[oa]|sombrero/.test(name)) return "Hat";
  return "Accessory";
}
