import type { Metadata } from "next";
import { garmentPhotoFor, starterGarments, type Garment } from "../../garments";
import {
  MixMatchCanvas,
  type MixMatchGarment,
} from "./mix-match-canvas";

export const metadata: Metadata = {
  title: "Mix & match | Formé",
  description: "Prueba prendas por filas y guarda un look.",
  robots: {
    index: false,
    follow: false,
  },
};

const OPTIONS_PER_ROW = 12;

function toOption(
  garment: Garment,
  role: "complete" | "canvas" = "complete",
): MixMatchGarment {
  return {
    id: garment.id,
    name: garment.name,
    image: role === "canvas"
      ? garmentPhotoFor(garment, "canvas").image
      : garment.image,
    colorFamily: garment.colorFamily,
    tone: garment.tone,
    material: garment.material,
    finish: garment.finish,
    silhouette: garment.silhouette,
    garmentType: garment.garmentType,
    favorite: garment.favorite,
  };
}

function optionsFor(
  categories: Garment["category"][],
  role: "complete" | "canvas" = "complete",
) {
  return starterGarments
    .filter((garment) => categories.includes(garment.category))
    .slice(0, OPTIONS_PER_ROW)
    .map((garment) => toOption(garment, role));
}

export default function MixMatchPage() {
  return (
    <MixMatchCanvas
      outerwear={optionsFor(["Outerwear", "Tailoring"])}
      tops={optionsFor(["Tops"])}
      bottoms={optionsFor(["Bottoms"])}
      footwear={optionsFor(["Footwear"])}
      accessories={optionsFor(["Accessories"])}
    />
  );
}
