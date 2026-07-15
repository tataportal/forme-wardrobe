"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { classifyGarment, formeBasics, Garment, starterGarments } from "./garments";

type View = "wardrobe" | "studio";
type WardrobePanel = "pieces" | "basics" | "looks" | "upload";
type StudioLibraryFilter = "all" | "personal" | "forme" | "footwear" | "accessories";
type CanvasPiece = {
  instanceId: string;
  garmentId: string;
  variant: "closed" | "open";
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};

type DragSession = {
  instanceId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

type PointerTrack = {
  instanceId: string;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
  wasSelected: boolean;
  startedAt: number;
};

type PinchSession = {
  instanceId: string;
  pointerIds: [number, number];
  startDistance: number;
  startScale: number;
  startAngle: number;
  startRotation: number;
};

type WardrobeFilters = {
  category: string;
  colorFamily: string;
  tone: string;
  material: string;
  finish: string;
  silhouette: string;
};

type FilterKey = keyof WardrobeFilters;
type FilterOptions = Record<FilterKey, string[]> & { tonesByColor: Record<string, string[]> };
type GarmentDraft = Pick<Garment, "id" | "name" | "category" | "colorFamily" | "tone" | "material" | "finish" | "silhouette"> & {
  brand: string;
  tags: string[];
};

type StoredGarmentEdit = Omit<GarmentDraft, "id">;
type ApiGarment = Omit<GarmentDraft, "id"> & {
  id: string;
  favorite?: boolean;
  deleted?: boolean;
  status: Garment["status"];
  image?: string;
  generatedImage?: string;
  generatedOpenImage?: string;
  originalImage?: string;
  openImage?: string;
  quality?: "low" | "medium";
  qaStatus?: "pending" | "passed" | "review";
  qaNotes?: string;
};
type WardrobeProfile = { name: string; handle: string; avatarUrl?: string | null; isOwner?: boolean };
type SessionStatus = "checking" | "guest" | "authenticated";
type UploadStatus = "ready" | "uploading" | "processing" | "done" | "waiting" | "failed";
type UploadItem = {
  id: string;
  file: File;
  preview: string;
  name: string;
  category: Garment["category"];
  status: UploadStatus;
  garmentId?: string;
  error?: string;
};

type SavedLook = {
  id: string;
  name: string;
  items: CanvasPiece[];
  createdAt?: string;
  updatedAt?: string;
};

type StyleCode = "casual" | "smart" | "formal" | "experimental";
type StyleMoment = "day" | "night";
type StyleOccasion = "daily" | "work" | "dinner" | "event";
type StylingStrategy = "balanced" | "contrast" | "statement";
type StylingRecommendation = {
  id: StylingStrategy;
  title: string;
  name: string;
  reason: string;
  items: CanvasPiece[];
};
type LookIteration = {
  id: string;
  title: string;
  detail: string;
  items: CanvasPiece[];
};

const emptyFilters: WardrobeFilters = {
  category: "All",
  colorFamily: "All",
  tone: "All",
  material: "All",
  finish: "All",
  silhouette: "All",
};

const garmentEditsStorageKey = "forme-garment-edits-v1";
const demoLooksStorageKey = "forme-demo-looks-v1";
const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
const operationalSiteUrl = "https://forme.frensonly.club/";
const currentOutfitId = "current-look";
const maxBatchFiles = 15;
const discountedBatchThreshold = 5;
const maxUploadBytes = 20 * 1024 * 1024;
const uploadStatusLabels: Record<UploadStatus, string> = {
  ready: "LISTA",
  uploading: "SUBIENDO",
  processing: "CREANDO RECORTE",
  done: "TERMINADA",
  waiting: "GUARDADA",
  failed: "REVISAR",
};

const styleCodeLabels: Record<StyleCode, string> = { casual: "Casual", smart: "Smart", formal: "Formal", experimental: "Experimental" };
const styleMomentLabels: Record<StyleMoment, string> = { day: "Día", night: "Noche" };
const styleOccasionLabels: Record<StyleOccasion, string> = { daily: "Diario", work: "Trabajo", dinner: "Cena", event: "Evento" };
const stylingStrategyLabels: Record<StylingStrategy, string> = { balanced: "Seguro", contrast: "Contraste", statement: "Statement" };

const filterLabels: Array<{ key: FilterKey; label: string }> = [
  { key: "category", label: "Tipo" },
  { key: "colorFamily", label: "Color" },
  { key: "tone", label: "Tono" },
  { key: "material", label: "Material" },
  { key: "finish", label: "Acabado" },
  { key: "silhouette", label: "Corte" },
];

const valueTranslations: Record<string, string> = {
  All: "Todos",
  Outerwear: "Abrigos",
  Tops: "Prendas superiores",
  Bottoms: "Pantalones",
  Tailoring: "Sastrería",
  Footwear: "Calzado",
  Accessories: "Accesorios",
  Black: "Negro",
  Blue: "Azul",
  Brown: "Marrón",
  Green: "Verde",
  Grey: "Gris",
  White: "Blanco",
  Other: "Otro",
  "Red / orange": "Rojo / naranja",
  "Black / Green": "Negro / verde",
  "Brown / Black": "Marrón / negro",
  Cream: "Crema",
  "Dark brown": "Marrón oscuro",
  "Denim blue": "Azul denim",
  Ivory: "Marfil",
  "Light blue": "Celeste",
  Navy: "Azul marino",
  "Optic white": "Blanco óptico",
  Orange: "Naranja",
  "Pitch black": "Negro intenso",
  "Red / Blue": "Rojo / azul",
  Sage: "Verde salvia",
  Stone: "Piedra",
  "Tan / camel": "Tostado / camel",
  "Washed black": "Negro lavado",
  Custom: "Personalizado",
  Unclassified: "Sin clasificar",
  Cotton: "Algodón",
  Fleece: "Polar",
  Knit: "Punto",
  Leather: "Cuero",
  Acetate: "Acetato",
  Shearling: "Borrego",
  "Technical nylon": "Nylon técnico",
  "Transparent shell": "Material transparente",
  "Wool blend": "Mezcla de lana",
  Glossy: "Brillante",
  "Low sheen": "Semimate",
  Matte: "Mate",
  Textured: "Texturizado",
  Transparent: "Transparente",
  Cropped: "Corto",
  Draped: "Drapeado",
  Longline: "Largo",
  Oversized: "Oversize",
  Regular: "Regular",
  Relaxed: "Relajado",
};

const garmentNameTranslations: Record<string, string> = {
  "Daisy Coach Jacket": "Chaqueta coach Daisy",
  "WFP Bomber": "Bomber WFP",
  "Navy Peacoat": "Abrigo cruzado azul marino",
  "Leather Hooded Shirt": "Sobrecamisa de cuero con capucha",
  "Utility Field Jacket": "Chaqueta utilitaria",
  "Leather Blazer": "Blazer de cuero",
  "Asymmetric Trench": "Trench asimétrico",
  "Padded Collar Jacket": "Chaqueta de cuello acolchado",
  "Belted Short Coat": "Abrigo corto con cinturón",
  "Leather Bomber": "Bomber de cuero",
  "Single-Breasted Blazer": "Blazer de un botón",
  "Track Shell": "Chaqueta técnica deportiva",
  "Leather Sports Bomber": "Bomber deportiva de cuero",
  "Drawcord Bomber": "Bomber con cordones",
  "Graphic Tailored Blazer": "Blazer gráfico sastre",
  "Camel Wrap Coat": "Abrigo envolvente camel",
  "Funnel-Neck Cape": "Capa de cuello alto",
  "Leather Hooded Bomber": "Bomber de cuero con capucha",
  "Leather Zip Blouson": "Blusón de cuero",
  "Long Black Trench": "Trench negro largo",
  "Lightweight Shell": "Chaqueta técnica ligera",
  "Tiger Fleece": "Polar de tigre",
  "Graphic Varsity Jacket": "Varsity gráfica",
  "Essentials Crewneck": "Sudadera Essentials",
  "Fur-Trim Leather Bomber": "Bomber de cuero con pelo",
  "Tan Coach Jacket": "Chaqueta coach tostada",
  "Hooded Field Parka": "Parka de campo con capucha",
  "Open-Knit Sweater": "Jersey de punto abierto",
  "Sage Puffer": "Puffer verde salvia",
  "Kimono Blazer": "Blazer kimono",
  "Embroidered Cape Coat": "Abrigo capa bordado",
  "Greige Technical Shell": "Chaqueta técnica greige",
  "Brown Shearling Coat": "Abrigo de borrego marrón",
  "Floral Fleece": "Polar floral",
  "Embroidered Coach Jacket": "Chaqueta coach bordada",
  "Technical Long Parka": "Parka técnica larga",
  "Transparent Rain Shell": "Impermeable transparente",
  "Cape Coat": "Abrigo capa",
  "Ivory Collarless Jacket": "Chaqueta marfil sin cuello",
  "Light Denim Jacket": "Chaqueta denim clara",
  "Draped Wool Poncho": "Poncho de lana drapeado",
  "Frog-Closure Jacket": "Chaqueta de cierres chinos",
  "Contrast-Piped Shirt": "Camisa con vivos en contraste",
  "Draped Black Shirt": "Camisa negra drapeada",
  "Human Made Jacket": "Chaqueta Human Made",
  "MA-1 Bomber": "Bomber MA-1",
  "Toggle Jacket": "Chaqueta con alamares",
  "White Track Shell": "Chaqueta deportiva blanca",
  "Ivory Technical Shell": "Chaqueta técnica marfil",
  "Cropped Double Blazer": "Blazer cruzado corto",
  "Classic Straight Jeans": "Jeans rectos clásicos",
  "Washed Black Jeans": "Jeans negros lavados",
  "Wide-Leg Trousers": "Pantalón de pierna ancha",
  "Pleated Chinos": "Chinos con pinzas",
  "Basic White Tee": "Camiseta blanca básica",
  "Oversized Black Tee": "Camiseta negra oversize",
  "Blue Long-Sleeve Shirt": "Camisa azul de manga larga",
  "Black Short-Sleeve Shirt": "Camisa negra de manga corta",
  "White Leather Sneakers": "Zapatillas blancas",
  "Black Leather Shoes": "Zapatos negros de cuero",
  "Brown Leather Shoes": "Zapatos marrones de cuero",
  "Black Pumps": "Tacones negros",
  "Black Cap": "Gorra negra",
  "Black Beanie": "Beanie negro",
  "Black Rectangular Sunglasses": "Lentes negros rectangulares",
  "Black Tote": "Tote negro",
};

const translateValue = (value: string) => valueTranslations[value] ?? value;
const translateGarmentName = (name: string) => garmentNameTranslations[name] ?? name;

const matchFilters = (garment: Garment, filters: WardrobeFilters) => filterLabels.every(({ key }) => filters[key] === "All" || garment[key] === filters[key]);

function AttributeFilters({ value, options, compact = false, onChange, onReset }: {
  value: WardrobeFilters;
  options: FilterOptions;
  compact?: boolean;
  onChange: (key: FilterKey, next: string) => void;
  onReset: () => void;
}) {
  const activeCount = Object.values(value).filter((item) => item !== "All").length;
  return (
    <div className={`attribute-filters ${compact ? "compact" : ""}`} aria-label="Filtrar prendas">
      {filterLabels.map(({ key, label }) => {
        const values = key === "tone" && value.colorFamily !== "All" ? options.tonesByColor[value.colorFamily] ?? [] : options[key];
        return (
          <label key={key}>{label}
            <select value={value[key]} onChange={(event) => onChange(key, event.target.value)}>
              <option value="All">Todos</option>
              {values.map((item) => <option value={item} key={item}>{translateValue(item)}</option>)}
            </select>
          </label>
        );
      })}
      <button type="button" className="reset-filters" disabled={activeCount === 0} onClick={onReset}>LIMPIAR {activeCount > 0 ? `(${activeCount})` : ""}</button>
    </div>
  );
}

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;
const imageSrc = (path: string) => (path.startsWith("/") ? asset(path) : path);
const cleanCanvasImage = (path: string) => path.startsWith("/wardrobe/cutouts/")
  ? path.replace("/wardrobe/cutouts/", "/wardrobe/clean/")
  : path;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeDegrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

async function processingFileFor(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxEdge = 2048;
    const ratio = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * ratio));
    const height = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas no disponible");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) throw new Error("No se pudo optimizar la foto");
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-processing.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function whiteStudioCutout(sourceUrl: string): Promise<{ file: File; qaStatus: "passed" | "review"; qaNotes: string }> {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo abrir la imagen generada.");
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("No se pudo preparar el recorte.");
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = image;
  const width = canvas.width;
  const height = canvas.height;
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  const isStudioWhite = (index: number) => {
    const offset = index * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    return Math.min(r, g, b) >= 244 && Math.max(r, g, b) - Math.min(r, g, b) <= 18;
  };
  const seed = (index: number) => {
    if (!visited[index] && isStudioWhite(index)) {
      visited[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) { seed(x); seed((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y += 1) { seed(y * width); seed(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) seed(index - 1);
    if (x + 1 < width) seed(index + 1);
    if (y > 0) seed(index - width);
    if (y + 1 < height) seed(index + width);
  }
  for (let index = 0; index < total; index += 1) if (visited[index]) data[index * 4 + 3] = 0;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foreground = 0;
  for (let index = 0; index < total; index += 1) {
    if (data[index * 4 + 3] < 24) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    foreground += 1;
  }
  context.putImageData(image, 0, 0);
  const coverage = foreground / total;
  const marginX = Math.min(minX, width - 1 - maxX) / width;
  const marginY = Math.min(minY, height - 1 - maxY) / height;
  const needsReview = foreground === 0 || coverage < 0.055 || coverage > 0.82 || marginX < 0.012 || marginY < 0.012;
  const qaNotes = needsReview
    ? "La silueta quedó demasiado cerca del borde o con una proporción inusual."
    : "Silueta completa, márgenes correctos y fondo exterior transparente.";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("No se pudo guardar el recorte.");
  return { file: new File([blob], "cutout.png", { type: "image/png" }), qaStatus: needsReview ? "review" : "passed", qaNotes };
}
const apiPayload = (garment: Garment | GarmentDraft) => ({
  name: garment.name.trim() || "Prenda sin nombre",
  brand: garment.brand ?? "",
  category: garment.category,
  colorFamily: garment.colorFamily,
  tone: garment.tone,
  material: garment.material,
  finish: garment.finish,
  silhouette: garment.silhouette,
  favorite: "favorite" in garment ? Boolean(garment.favorite) : false,
  tags: garment.tags ?? [],
});

function mergeApiGarments(current: Garment[], updates: ApiGarment[]): Garment[] {
  const hidden = new Set(updates.filter((item) => item.deleted).map((item) => item.id));
  const byId = new Map(current.filter((item) => !hidden.has(item.id)).map((item) => [item.id, item]));
  for (const item of updates) {
    if (item.deleted) continue;
    const existing = byId.get(item.id);
    const image = item.image || item.originalImage || existing?.image;
    if (!image) continue;
    byId.set(item.id, {
      ...(existing ?? {}),
      ...item,
      id: item.id,
      image,
      color: item.tone,
      status: item.status,
    } as Garment);
  }
  const orderedIds = [
    ...updates.filter((item) => !item.deleted && !starterGarments.some((starter) => starter.id === item.id)).map((item) => item.id),
    ...current.map((item) => item.id),
  ];
  return [...new Set(orderedIds)].map((id) => byId.get(id)).filter((item): item is Garment => Boolean(item));
}
const layerBase = (category: Garment["category"]) => {
  if (category === "Bottoms") return 1000;
  if (category === "Tops") return 2000;
  if (category === "Outerwear" || category === "Tailoring") return 3000;
  if (category === "Footwear") return 4000;
  return 5000;
};
const defaultPlacement = (garment: Garment) => {
  if (garment.category === "Footwear") return { x: 50, y: 87, scale: 0.34 };
  if (garment.category === "Accessories") {
    if (garment.id.includes("sunglasses")) return { x: 50, y: 17.5, scale: 0.14 };
    if (garment.id.includes("tote")) return { x: 74, y: 58, scale: 0.28 };
    return { x: 50, y: 10.5, scale: 0.22 };
  }
  if (garment.category === "Bottoms") {
    const scale = garment.silhouette === "Oversized" ? 0.55 : garment.silhouette === "Relaxed" ? 0.57 : 0.59;
    return { x: 50, y: 66.5, scale };
  }
  if (garment.category === "Tops") {
    const scale = garment.silhouette === "Oversized"
      ? 0.43
      : garment.silhouette === "Longline"
        ? 0.45
        : garment.silhouette === "Relaxed"
          ? 0.46
          : 0.48;
    return { x: 50, y: garment.silhouette === "Longline" ? 34 : 31.5, scale };
  }
  const outerPreset: Record<string, { y: number; scale: number }> = {
    Cropped: { y: 30.5, scale: 0.56 },
    Longline: { y: 38, scale: 0.46 },
    Oversized: { y: 34, scale: 0.49 },
    Draped: { y: 34.5, scale: 0.49 },
    Relaxed: { y: 32.5, scale: 0.51 },
    Regular: { y: 32, scale: 0.52 },
  };
  return { x: 50, ...(outerPreset[garment.silhouette] ?? outerPreset.Regular) };
};

const roundedScale = (scale: number) => Math.round(scale * 1000) / 1000;

function recommendationOuterPlacement(garment: Garment) {
  const placement = defaultPlacement(garment);
  const searchable = searchableGarment(garment);

  if (/funnel-neck cape|cape coat|poncho/.test(searchable)) {
    return { ...placement, y: placement.y - 1, scale: roundedScale(placement.scale * 1.18) };
  }
  if (/puffer/.test(searchable)) {
    return { ...placement, y: placement.y - 1, scale: roundedScale(placement.scale * 1.12) };
  }
  return placement;
}

function recommendationTopPlacement(top: Garment, outer: Garment) {
  const placement = defaultPlacement(top);
  const outerText = searchableGarment(outer);

  if (/funnel-neck cape|cape coat|poncho/.test(outerText)) {
    return { ...placement, y: placement.y + 0.75, scale: roundedScale(placement.scale * 0.88) };
  }
  if (/puffer/.test(outerText)) {
    return { ...placement, y: placement.y + 0.5, scale: roundedScale(placement.scale * 0.92) };
  }
  return placement;
}

function normalizedCanvasPiece(piece: CanvasPiece, garment?: Garment): CanvasPiece {
  if (garment?.category !== "Bottoms" || piece.scale < 0.66) return piece;
  return { ...piece, scale: Math.round(piece.scale * 0.81 * 1000) / 1000 };
}

const initialCanvas: CanvasPiece[] = [
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "initial-tee", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 31.5, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "initial-jacket", garmentId: "archive-002", variant: "open", x: 50, y: 32.5, scale: 0.51, rotation: 0, z: 3001 },
];

const initialDemoCanvas: CanvasPiece[] = [
  { instanceId: "demo-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.59, rotation: 0, z: 1001 },
  { instanceId: "demo-top", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 31.5, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "demo-shoes", garmentId: "footwear-white-sneakers", variant: "closed", x: 50, y: 87, scale: 0.34, rotation: 0, z: 4001 },
  { instanceId: "demo-glasses", garmentId: "accessory-black-sunglasses", variant: "closed", x: 50, y: 17.5, scale: 0.14, rotation: 0, z: 5001 },
  { instanceId: "demo-tote", garmentId: "accessory-black-tote", variant: "closed", x: 74, y: 58, scale: 0.28, rotation: 0, z: 5002 },
];

const stylingNeutralFamilies = new Set(["Black", "White", "Grey", "Brown", "Blue"]);

function searchableGarment(garment: Garment) {
  return `${garment.name} ${garment.material} ${garment.finish} ${garment.tone} ${garment.tags?.join(" ") ?? ""}`.toLocaleLowerCase();
}

function contextGarmentScore(garment: Garment, code: StyleCode, moment: StyleMoment, occasion: StyleOccasion) {
  const searchable = searchableGarment(garment);
  let score = 0;

  if (code === "formal") {
    if (garment.category === "Tailoring") score += 12;
    if (/trouser|chino|shirt|blazer|coat|peacoat|draped|piped/.test(searchable)) score += 7;
    if (/tee|jeans|fleece|puffer|parka|track/.test(searchable)) score -= 7;
  } else if (code === "smart") {
    if (garment.category === "Tailoring") score += 7;
    if (/shirt|blazer|trouser|chino|leather|knit|denim/.test(searchable)) score += 4;
    if (/fleece|track/.test(searchable)) score -= 3;
  } else if (code === "experimental") {
    if (/graphic|embroidered|transparent|draped|kimono|cape|poncho|varsity|funnel/.test(searchable)) score += 9;
    if (["Textured", "Glossy", "Transparent"].includes(garment.finish)) score += 5;
    if (["Oversized", "Draped", "Cropped"].includes(garment.silhouette)) score += 4;
  } else {
    if (/jeans|tee|bomber|puffer|crewneck|sweater|fleece|coach|parka/.test(searchable)) score += 7;
    if (["Cotton", "Denim", "Technical nylon", "Knit", "Fleece"].includes(garment.material)) score += 3;
    if (garment.category === "Tailoring") score -= 3;
  }

  if (occasion === "work") {
    if (garment.category === "Tailoring" || /shirt|trouser|chino|coat/.test(searchable)) score += 6;
    if (/graphic|fleece|transparent|track/.test(searchable)) score -= 5;
  } else if (occasion === "dinner") {
    if (/leather|draped|blazer|knit/.test(searchable) || garment.finish === "Low sheen") score += 5;
  } else if (occasion === "event") {
    if (garment.category === "Tailoring" || /graphic|embroidered|cape|kimono|blazer/.test(searchable)) score += 6;
  } else if (/denim|tee|coach|bomber|chino/.test(searchable)) {
    score += 4;
  }

  if (moment === "night") {
    if (["Black", "Blue", "Grey"].includes(garment.colorFamily)) score += 4;
    if (["Leather", "Wool blend"].includes(garment.material) || ["Glossy", "Low sheen"].includes(garment.finish)) score += 3;
  } else {
    if (["White", "Blue", "Brown", "Green", "Grey"].includes(garment.colorFamily)) score += 3;
    if (["Matte", "Textured"].includes(garment.finish)) score += 2;
  }

  return score;
}

function paletteScore(top: Garment, bottom: Garment, outer: Garment, strategy: StylingStrategy) {
  const baseIsNeutral = stylingNeutralFamilies.has(top.colorFamily) && stylingNeutralFamilies.has(bottom.colorFamily);
  const sameBase = top.colorFamily === bottom.colorFamily;
  const outerIsNeutral = stylingNeutralFamilies.has(outer.colorFamily);
  let score = baseIsNeutral ? 5 : 0;
  if (sameBase) score += 2;
  if (outer.colorFamily === top.colorFamily || outer.colorFamily === bottom.colorFamily) score += 3;
  if (baseIsNeutral && !outerIsNeutral) score += strategy === "contrast" || strategy === "statement" ? 8 : 2;
  if (!baseIsNeutral && !outerIsNeutral && outer.colorFamily !== top.colorFamily && outer.colorFamily !== bottom.colorFamily) score -= 5;
  return score;
}

function silhouetteScore(top: Garment, bottom: Garment, outer: Garment) {
  const wideBottom = ["Oversized", "Relaxed", "Draped"].includes(bottom.silhouette);
  const largeOuter = ["Oversized", "Longline", "Draped"].includes(outer.silhouette);
  let score = 0;
  if (largeOuter && !wideBottom) score += 5;
  if (wideBottom && ["Cropped", "Regular"].includes(outer.silhouette)) score += 5;
  if (wideBottom && largeOuter) score -= 5;
  if (top.silhouette === "Regular" && (wideBottom || largeOuter)) score += 3;
  if (outer.openImage) score += 2;
  return score;
}

function strategyScore(top: Garment, bottom: Garment, outer: Garment, strategy: StylingStrategy) {
  const outerText = searchableGarment(outer);
  if (strategy === "balanced") {
    return (stylingNeutralFamilies.has(outer.colorFamily) ? 6 : 0)
      + (["Matte", "Low sheen"].includes(outer.finish) ? 3 : 0)
      + (outer.category === "Tailoring" && /jeans|denim/.test(searchableGarment(bottom)) ? 2 : 0);
  }
  if (strategy === "contrast") {
    return (outer.colorFamily !== top.colorFamily && outer.colorFamily !== bottom.colorFamily ? 6 : 0)
      + (outer.material !== top.material ? 3 : 0)
      + (outer.category === "Tailoring" && /jeans|denim/.test(searchableGarment(bottom)) ? 5 : 0);
  }
  return (/graphic|embroidered|transparent|cape|kimono|varsity|funnel/.test(outerText) ? 9 : 0)
    + (["Textured", "Glossy", "Transparent"].includes(outer.finish) ? 6 : 0)
    + (["Oversized", "Draped", "Cropped"].includes(outer.silhouette) ? 4 : 0)
    + (stylingNeutralFamilies.has(top.colorFamily) && stylingNeutralFamilies.has(bottom.colorFamily) ? 4 : 0);
}

function stylingReason(strategy: StylingStrategy, top: Garment, bottom: Garment, outer: Garment, occasion: StyleOccasion, moment: StyleMoment) {
  const topName = translateGarmentName(top.name);
  const bottomName = translateGarmentName(bottom.name);
  const outerName = translateGarmentName(outer.name);
  const context = `${styleOccasionLabels[occasion].toLocaleLowerCase()} de ${styleMomentLabels[moment].toLocaleLowerCase()}`;
  if (strategy === "balanced") return `${topName} y ${bottomName} construyen una base limpia; ${outerName} mantiene la paleta y equilibra el volumen. Es la opción más fácil de llevar para ${context}.`;
  if (strategy === "contrast") return `${outerName} introduce contraste de color o material sobre la base de ${topName} y ${bottomName}. Las siluetas no compiten, así que el look se siente intencional para ${context}.`;
  return `${outerName} funciona como pieza protagonista. ${topName} y ${bottomName} permanecen contenidos para dejarle el foco sin perder proporción; funciona especialmente bien para ${context}.`;
}

function buildStylingRecommendations(garments: Garment[], code: StyleCode, moment: StyleMoment, occasion: StyleOccasion): StylingRecommendation[] {
  const bottoms = garments.filter((item) => item.category === "Bottoms");
  const tops = garments.filter((item) => item.category === "Tops");
  const outerLayers = garments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
  if (!bottoms.length || !tops.length || !outerLayers.length) return [];
  const strategies: StylingStrategy[] = ["balanced", "contrast", "statement"];
  const usedOuter = new Set<string>();
  const usedCombinations = new Set<string>();

  return strategies.flatMap((strategy) => {
    const candidates = bottoms.flatMap((bottom) => tops.flatMap((top) => outerLayers.map((outer) => ({
      bottom,
      top,
      outer,
      score: contextGarmentScore(bottom, code, moment, occasion)
        + contextGarmentScore(top, code, moment, occasion)
        + contextGarmentScore(outer, code, moment, occasion)
        + paletteScore(top, bottom, outer, strategy)
        + silhouetteScore(top, bottom, outer)
        + strategyScore(top, bottom, outer, strategy),
    }))));
    candidates.sort((a, b) => b.score - a.score || `${a.outer.id}-${a.top.id}-${a.bottom.id}`.localeCompare(`${b.outer.id}-${b.top.id}-${b.bottom.id}`));
    const choice = candidates.find((candidate) => !usedOuter.has(candidate.outer.id) && !usedCombinations.has(`${candidate.bottom.id}:${candidate.top.id}:${candidate.outer.id}`)) ?? candidates[0];
    if (!choice) return [];
    usedOuter.add(choice.outer.id);
    usedCombinations.add(`${choice.bottom.id}:${choice.top.id}:${choice.outer.id}`);
    const bottomPlacement = defaultPlacement(choice.bottom);
    const topPlacement = recommendationTopPlacement(choice.top, choice.outer);
    const outerPlacement = recommendationOuterPlacement(choice.outer);
    const items: CanvasPiece[] = [
      { instanceId: `${strategy}-bottom`, garmentId: choice.bottom.id, variant: "closed", ...bottomPlacement, rotation: 0, z: layerBase(choice.bottom.category) + 1 },
      { instanceId: `${strategy}-top`, garmentId: choice.top.id, variant: "closed", ...topPlacement, rotation: 0, z: layerBase(choice.top.category) + 1 },
      { instanceId: `${strategy}-outer`, garmentId: choice.outer.id, variant: choice.outer.openImage ? "open" : "closed", ...outerPlacement, rotation: 0, z: layerBase(choice.outer.category) + 1 },
    ];
    return [{
      id: strategy,
      title: stylingStrategyLabels[strategy],
      name: `${styleOccasionLabels[occasion]} · ${styleCodeLabels[code]} · ${stylingStrategyLabels[strategy]}`,
      reason: stylingReason(strategy, choice.top, choice.bottom, choice.outer, occasion, moment),
      items,
    }];
  });
}

function buildDemoRecommendations(code: StyleCode, moment: StyleMoment, occasion: StyleOccasion): StylingRecommendation[] {
  const byId = new Map(formeBasics.map((item) => [item.id, item]));
  const dressy = code === "formal" || code === "smart" || occasion === "work" || occasion === "dinner";
  const recipes = [
    {
      id: "balanced" as const,
      title: "Seguro",
      name: `${styleOccasionLabels[occasion]} · ${styleCodeLabels[code]} · Base limpia`,
      reason: dressy
        ? "La camisa azul y el pantalón negro crean una base ordenada; los zapatos marrones suavizan el contraste sin volverla rígida."
        : "La camiseta blanca, el denim recto y las zapatillas blancas mantienen una proporción simple y fácil de repetir.",
      ids: dressy
        ? ["top-blue-long-sleeve-shirt", "bottom-black-trouser", "footwear-brown-leather-shoes", "accessory-black-tote"]
        : ["top-basic-white-tee", "bottom-blue-jeans", "footwear-white-sneakers", "accessory-black-cap"],
    },
    {
      id: "contrast" as const,
      title: "Contraste",
      name: `${styleMomentLabels[moment]} · Contraste controlado`,
      reason: "El top negro contiene la parte superior, mientras el denim azul y el calzado oscuro separan los volúmenes con claridad.",
      ids: ["top-black-short-sleeve-shirt", "bottom-blue-jeans", "footwear-black-leather-shoes", "accessory-black-sunglasses"],
    },
    {
      id: "statement" as const,
      title: "Statement",
      name: `${styleCodeLabels[code]} · Monocromo`,
      reason: "La silueta negra conecta top, pantalón y accesorios. El tacón estiliza la base y el tote mantiene el look funcional.",
      ids: ["top-oversized-black-tee", "bottom-black-trouser", "footwear-black-pumps", "accessory-black-tote", "accessory-black-sunglasses"],
    },
  ];

  return recipes.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    name: recipe.name,
    reason: recipe.reason,
    items: recipe.ids.flatMap((id, index) => {
      const garment = byId.get(id);
      if (!garment) return [];
      const placement = defaultPlacement(garment);
      return [{
        instanceId: `demo-${recipe.id}-${id}`,
        garmentId: id,
        variant: "closed" as const,
        ...placement,
        rotation: 0,
        z: layerBase(garment.category) + index + 1,
      }];
    }),
  }));
}

const iterationProfiles = [
  { id: "clean", title: "Limpio", outer: /collarless|coach|field|shell/, footwear: /white|sneaker/, accessory: /tote/ },
  { id: "contrast", title: "Contraste", outer: /puffer|fleece|tan|camel|sage|denim/, footwear: /black leather/, accessory: /sunglasses/ },
  { id: "statement", title: "Statement", outer: /graphic|embroidered|cape|poncho|transparent|varsity/, footwear: /pump|black/, accessory: /sunglasses|beanie/ },
  { id: "tailored", title: "Pulido", outer: /blazer|coat|trench|leather/, footwear: /brown|black leather/, accessory: /tote/ },
  { id: "relaxed", title: "Relajado", outer: /parka|puffer|coach|fleece|bomber|blouson/, footwear: /sneaker/, accessory: /cap|beanie/ },
] as const;

function buildLookIterations(garments: Garment[], current: CanvasPiece[]): LookIteration[] {
  const byId = new Map(garments.map((item) => [item.id, item]));
  const fixed = current.filter((piece) => {
    const garment = byId.get(piece.garmentId);
    return garment?.category === "Tops" || garment?.category === "Bottoms";
  });
  const hasTop = fixed.some((piece) => byId.get(piece.garmentId)?.category === "Tops");
  const hasBottom = fixed.some((piece) => byId.get(piece.garmentId)?.category === "Bottoms");
  if (!hasTop || !hasBottom) return [];

  const baseColors = new Set(fixed.map((piece) => byId.get(piece.garmentId)?.colorFamily).filter(Boolean));
  const outerwear = garments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
  const footwear = garments.filter((item) => item.category === "Footwear");
  const accessories = garments.filter((item) => item.category === "Accessories");
  const usedOuter = new Set<string>();
  const usedFootwear = new Set<string>();
  const usedAccessories = new Set<string>();

  return iterationProfiles.map((profile, profileIndex) => {
    const rankedOuter = [...outerwear].sort((a, b) => {
      const score = (garment: Garment) => {
        const text = searchableGarment(garment);
        let value = profile.outer.test(text) ? 20 : 0;
        if (profile.id === "contrast" && !baseColors.has(garment.colorFamily)) value += 8;
        if (profile.id === "statement" && ["Textured", "Glossy", "Transparent"].includes(garment.finish)) value += 6;
        if (profile.id === "tailored" && garment.category === "Tailoring") value += 9;
        if (profile.id === "clean" && stylingNeutralFamilies.has(garment.colorFamily)) value += 5;
        if (profile.id === "relaxed" && ["Relaxed", "Oversized"].includes(garment.silhouette)) value += 5;
        return value;
      };
      return score(b) - score(a) || a.id.localeCompare(b.id);
    });
    const outer = rankedOuter.find((item) => !usedOuter.has(item.id)) ?? rankedOuter[profileIndex % Math.max(rankedOuter.length, 1)];
    if (outer) usedOuter.add(outer.id);

    const rankedFootwear = [...footwear].sort((a, b) => {
      const aMatch = profile.footwear.test(searchableGarment(a)) ? 1 : 0;
      const bMatch = profile.footwear.test(searchableGarment(b)) ? 1 : 0;
      return bMatch - aMatch || a.id.localeCompare(b.id);
    });
    const shoe = rankedFootwear.find((item) => !usedFootwear.has(item.id)) ?? rankedFootwear[profileIndex % Math.max(rankedFootwear.length, 1)];
    if (shoe) usedFootwear.add(shoe.id);
    const rankedAccessories = [...accessories].sort((a, b) => {
      const aMatch = profile.accessory.test(searchableGarment(a)) ? 1 : 0;
      const bMatch = profile.accessory.test(searchableGarment(b)) ? 1 : 0;
      return bMatch - aMatch || a.id.localeCompare(b.id);
    });
    const accessory = rankedAccessories.find((item) => !usedAccessories.has(item.id)) ?? rankedAccessories[profileIndex % Math.max(rankedAccessories.length, 1)];
    if (accessory) usedAccessories.add(accessory.id);

    const additions = [outer, shoe, accessory].filter((item): item is Garment => Boolean(item));
    const items: CanvasPiece[] = [
      ...fixed.map((piece) => ({ ...piece, instanceId: `iterate-${profile.id}-${piece.instanceId}` })),
      ...additions.map((garment, index) => {
        const placement = garment.category === "Outerwear" || garment.category === "Tailoring"
          ? recommendationOuterPlacement(garment)
          : defaultPlacement(garment);
        return {
          instanceId: `iterate-${profile.id}-${garment.id}`,
          garmentId: garment.id,
          variant: garment.openImage ? "open" as const : "closed" as const,
          ...placement,
          rotation: 0,
          z: layerBase(garment.category) + index + 1,
        };
      }),
    ];
    const detail = [outer, shoe, accessory].filter((item): item is Garment => Boolean(item)).map((item) => translateGarmentName(item.name)).join(" · ");
    return { id: profile.id, title: profile.title, detail, items };
  });
}

function LookPreview({ look, garmentById }: { look: SavedLook; garmentById: Map<string, Garment> }) {
  return (
    <div className="saved-look-preview" aria-hidden="true">
      {look.items.map((piece) => {
        const garment = garmentById.get(piece.garmentId);
        if (!garment) return null;
        const normalizedPiece = normalizedCanvasPiece(piece, garment);
        const source = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
        return <img
          key={piece.instanceId}
          src={imageSrc(cleanCanvasImage(source))}
          alt=""
          style={{
            left: `${normalizedPiece.x}%`,
            top: `${normalizedPiece.y}%`,
            zIndex: normalizedPiece.z,
            transform: `translate(-50%, -50%) rotate(${normalizedPiece.rotation}deg) scale(${normalizedPiece.scale})`,
          }}
        />;
      })}
    </div>
  );
}

export default function Home() {
  const [demoMode, setDemoMode] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("checking");
  const [view, setView] = useState<View>("wardrobe");
  const [wardrobePanel, setWardrobePanel] = useState<WardrobePanel>("basics");
  const [studioLibraryFilter, setStudioLibraryFilter] = useState<StudioLibraryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [garments, setGarments] = useState(formeBasics);
  const [archiveFilters, setArchiveFilters] = useState<WardrobeFilters>(emptyFilters);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [wardrobeError, setWardrobeError] = useState("");
  const [profile, setProfile] = useState<WardrobeProfile>({ name: "Tata", handle: "@tataportal" });
  const [canvasPieces, setCanvasPieces] = useState(initialDemoCanvas);
  const [savedLooks, setSavedLooks] = useState<SavedLook[]>([]);
  const [activeOutfitId, setActiveOutfitId] = useState<string | null>(null);
  const [activeLookName, setActiveLookName] = useState("Demo FORME");
  const [styleCode, setStyleCode] = useState<StyleCode>("casual");
  const [styleMoment, setStyleMoment] = useState<StyleMoment>("day");
  const [styleOccasion, setStyleOccasion] = useState<StyleOccasion>("daily");
  const [stylingRecommendations, setStylingRecommendations] = useState<StylingRecommendation[]>([]);
  const [lookIterations, setLookIterations] = useState<LookIteration[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [garmentDraft, setGarmentDraft] = useState<GarmentDraft | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [garmentSaved, setGarmentSaved] = useState(false);
  const [garmentSaveError, setGarmentSaveError] = useState("");
  const [savingOutfit, setSavingOutfit] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const pointerTracks = useRef(new Map<number, PointerTrack>());
  const pinchSession = useRef<PinchSession | null>(null);
  const finalizingCutouts = useRef(new Set<string>());

  const garmentById = useMemo(() => new Map(garments.map((item) => [item.id, item])), [garments]);
  const filterOptions = useMemo<FilterOptions>(() => {
    const unique = (key: FilterKey) => Array.from(new Set(garments.map((item) => item[key]))).sort();
    const tonesByColor = garments.reduce<Record<string, string[]>>((result, item) => {
      result[item.colorFamily] = Array.from(new Set([...(result[item.colorFamily] ?? []), item.tone])).sort();
      return result;
    }, {});
    return {
      category: unique("category"),
      colorFamily: unique("colorFamily"),
      tone: unique("tone"),
      material: unique("material"),
      finish: unique("finish"),
      silhouette: unique("silhouette"),
      tonesByColor,
    };
  }, [garments]);
  const personalGarments = garments.filter((item) => item.collection !== "forme");
  const sharedBasics = garments.filter((item) => item.collection === "forme");
  const catalogGarments = wardrobePanel === "basics" || demoMode ? sharedBasics : personalGarments;
  const visible = catalogGarments.filter((item) => matchFilters(item, archiveFilters));
  const studioGarments = garments.filter((item) => {
    if (studioLibraryFilter === "personal") return item.collection !== "forme";
    if (studioLibraryFilter === "forme") return item.collection === "forme";
    if (studioLibraryFilter === "footwear") return item.category === "Footwear";
    if (studioLibraryFilter === "accessories") return item.category === "Accessories";
    return true;
  });
  const selectedPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;
  const iterationBaseCount = canvasPieces.filter((piece) => {
    const category = garmentById.get(piece.garmentId)?.category;
    return category === "Tops" || category === "Bottoms";
  }).length;
  const canIterate = canvasPieces.some((piece) => garmentById.get(piece.garmentId)?.category === "Tops")
    && canvasPieces.some((piece) => garmentById.get(piece.garmentId)?.category === "Bottoms");
  const archiveFilterCount = Object.values(archiveFilters).filter((item) => item !== "All").length;
  const editingGarment = garmentDraft ? garmentById.get(garmentDraft.id) : undefined;
  const uploadRetryableCount = uploadItems.filter((item) => item.status === "ready" || item.status === "failed").length;
  const uploadFinishedCount = uploadItems.filter((item) => item.status === "done" || item.status === "waiting" || item.status === "failed").length;
  const editorTones = garmentDraft
    ? Array.from(new Set([garmentDraft.tone, ...(filterOptions.tonesByColor[garmentDraft.colorFamily] ?? [])])).filter(Boolean)
    : [];
  const profileImage = profile.avatarUrl || asset("/profile/tata.png");
  const profileImageClass = `profile-photo${profile.avatarUrl ? "" : " local-profile"}`;

  useEffect(() => {
    if (isStaticDemo) window.location.replace(operationalSiteUrl);
  }, []);

  useEffect(() => {
    if (!isStaticDemo) {
      let active = true;
      const loadAccount = async () => {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (sessionResponse.status === 401 || sessionResponse.status === 403) {
          if (!active) return;
          setDemoMode(true);
          setSessionStatus("guest");
          try {
            const storedLooks = localStorage.getItem(demoLooksStorageKey);
            setSavedLooks(storedLooks ? JSON.parse(storedLooks) as SavedLook[] : []);
          } catch {
            setSavedLooks([]);
          }
          setWardrobeError("");
          return;
        }
        if (!sessionResponse.ok) throw new Error("No se pudo revisar tu sesión.");
        const session = await sessionResponse.json() as { user: WardrobeProfile };
        const batchesReady = fetch("/api/batches/status", { cache: "no-store" }).catch(() => null);
        const [wardrobeResponse, outfitsResponse] = await Promise.all([
          batchesReady.then(() => fetch("/api/wardrobe", { cache: "no-store" })),
          fetch("/api/outfits", { cache: "no-store" }),
        ]);
        if (!wardrobeResponse.ok) throw new Error((await wardrobeResponse.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo abrir tu armario.");
        const wardrobe = await wardrobeResponse.json() as { garments: ApiGarment[] };
        const outfits = outfitsResponse.ok
          ? await outfitsResponse.json() as { outfits: SavedLook[] }
          : { outfits: [] };
        if (!active) return;
        const baseGarments = session.user.isOwner ? starterGarments : formeBasics;
        const loadedGarments = mergeApiGarments(baseGarments, wardrobe.garments);
        const loadedGarmentById = new Map(loadedGarments.map((item) => [item.id, item]));
        const normalizedLooks = outfits.outfits.map((look) => ({
          ...look,
          items: look.items.map((item) => normalizedCanvasPiece(item, loadedGarmentById.get(item.garmentId))),
        }));
        setDemoMode(false);
        setSessionStatus("authenticated");
        setGarments(loadedGarments);
        setProfile(session.user);
        setSavedLooks(normalizedLooks);
        setWardrobePanel("pieces");
        void Promise.all(wardrobe.garments.map((item) => finalizePendingCutouts(item))).catch(() => null);
        const savedLook = normalizedLooks.find((outfit) => outfit.id === currentOutfitId);
        if (savedLook?.items.length) {
          setCanvasPieces(savedLook.items);
          setActiveOutfitId(savedLook.id);
          setActiveLookName(savedLook.name);
          setSaved(true);
        } else {
          setCanvasPieces(session.user.isOwner ? initialCanvas : initialDemoCanvas);
          setActiveOutfitId(null);
          setActiveLookName("Nuevo look");
          setSaved(false);
        }
        setWardrobeError("");
      };
      void loadAccount().catch((error: unknown) => {
        if (!active) return;
        setSessionStatus("guest");
        setWardrobeError(error instanceof Error ? error.message : "No se pudo abrir tu armario.");
      });
      return () => { active = false; };
    }
    try {
      const stored = localStorage.getItem(garmentEditsStorageKey);
      if (!stored) return;
      const edits = JSON.parse(stored) as Record<string, StoredGarmentEdit>;
      const frame = window.requestAnimationFrame(() => {
        setGarments((items) => items.map((item) => edits[item.id] ? { ...item, ...edits[item.id], color: edits[item.id].tone } : item));
      });
      return () => window.cancelAnimationFrame(frame);
    } catch {
      // A malformed local edit should never block the wardrobe.
    }
  // The initial hydration intentionally runs once; pending cutouts are idempotent and guarded by a ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!garmentDraft) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGarmentDraft(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [garmentDraft]);

  function updateArchiveFilter(key: FilterKey, next: string) {
    setArchiveFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
  }

  function beginGoogleSignIn() {
    window.location.assign("/signin-with-chatgpt?return_to=%2F");
  }

  function openGarmentEditor(item: Garment) {
    setGarmentDraft({
      id: item.id,
      name: translateGarmentName(item.name),
      brand: item.brand ?? "",
      category: item.category,
      colorFamily: item.colorFamily,
      tone: item.tone,
      material: item.material,
      finish: item.finish,
      silhouette: item.silhouette,
      tags: item.tags ?? [],
    });
    setTagInput("");
    setGarmentSaved(false);
    setGarmentSaveError("");
  }

  function updateGarmentDraft<Key extends keyof GarmentDraft>(key: Key, next: GarmentDraft[Key]) {
    setGarmentDraft((current) => current ? { ...current, [key]: next } : current);
    setGarmentSaved(false);
    setGarmentSaveError("");
  }

  function addDraftTag() {
    const next = tagInput.trim().replace(/^#/, "");
    if (!next || !garmentDraft) return;
    if (!garmentDraft.tags.some((tag) => tag.toLocaleLowerCase() === next.toLocaleLowerCase())) {
      updateGarmentDraft("tags", [...garmentDraft.tags, next]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addDraftTag();
  }

  async function saveGarmentDraft() {
    if (!garmentDraft) return;
    const { id, ...edit } = garmentDraft;
    const normalized = { ...edit, name: edit.name.trim() || "Prenda sin nombre" };
    setGarments((items) => items.map((item) => item.id === id
      ? { ...item, ...normalized, color: edit.tone }
      : item));
    setGarmentSaveError("");
    if (isStaticDemo) {
      try {
        const stored = JSON.parse(localStorage.getItem(garmentEditsStorageKey) ?? "{}") as Record<string, StoredGarmentEdit>;
        localStorage.setItem(garmentEditsStorageKey, JSON.stringify({ ...stored, [id]: normalized }));
      } catch {
        // The edit still works for the current session if storage is unavailable.
      }
      setGarmentSaved(true);
      return;
    }
    try {
      const current = garments.find((item) => item.id === id);
      const response = await fetch(`/api/garments/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...normalized, favorite: current?.favorite ?? false }),
      });
      const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
      if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudieron guardar los cambios.");
      setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
      setGarmentSaved(true);
    } catch (error) {
      setGarmentSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }

  async function toggleFavorite(item: Garment) {
    const next = { ...item, favorite: !item.favorite };
    setGarments((items) => items.map((garment) => garment.id === item.id ? next : garment));
    if (isStaticDemo) return;
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(apiPayload(next)),
      });
      if (!response.ok) throw new Error();
    } catch {
      setGarments((items) => items.map((garment) => garment.id === item.id ? item : garment));
      setWardrobeError("No se pudo actualizar Favoritas.");
    }
  }

  async function deleteGarment(item: Garment) {
    setGarments((items) => items.filter((garment) => garment.id !== item.id));
    setCanvasPieces((items) => items.filter((piece) => piece.garmentId !== item.id));
    setGarmentDraft(null);
    if (isStaticDemo) return;
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(apiPayload(item)),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar la prenda.");
    } catch (error) {
      setGarments((items) => [item, ...items]);
      setWardrobeError(error instanceof Error ? error.message : "No se pudo eliminar la prenda.");
    }
  }

  function openWardrobe(panel: WardrobePanel = "pieces") {
    setView("wardrobe");
    setWardrobePanel(panel);
    setLibraryOpen(false);
  }

  async function finalizeCutoutVariant(item: ApiGarment, outputVariant: "closed" | "open"): Promise<ApiGarment> {
    const source = outputVariant === "open" ? item.generatedOpenImage : item.generatedImage;
    if (!source) return item;
    const lock = `${item.id}:${outputVariant}:${source}`;
    if (finalizingCutouts.current.has(lock)) return item;
    finalizingCutouts.current.add(lock);
    try {
      const cutout = await whiteStudioCutout(imageSrc(source));
      const body = new FormData();
      body.append("file", cutout.file);
      body.append("outputVariant", outputVariant);
      body.append("qaStatus", cutout.qaStatus);
      body.append("qaNotes", cutout.qaNotes);
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}/cutout`, { method: "POST", body });
      const result = await response.json().catch(() => null) as { garment?: ApiGarment; error?: string } | null;
      if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo terminar el recorte.");
      setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
      return result.garment;
    } finally {
      finalizingCutouts.current.delete(lock);
    }
  }

  async function finalizePendingCutouts(item: ApiGarment): Promise<ApiGarment> {
    if (item.status !== "cutout_pending") return item;
    let current = item;
    if (current.generatedImage && !current.image) current = await finalizeCutoutVariant(current, "closed");
    if (current.generatedOpenImage && !current.openImage) current = await finalizeCutoutVariant(current, "open");
    return current;
  }

  function resetUpload() {
    uploadItems.forEach((item) => {
      if (item.preview.startsWith("blob:") && !(isStaticDemo && item.status === "done")) URL.revokeObjectURL(item.preview);
    });
    setUploadItems([]);
    if (fileInput.current) fileInput.current.value = "";
    setUploadError("");
  }

  function acceptFiles(source: FileList | File[] | undefined) {
    const incoming = Array.from(source ?? []);
    if (!incoming.length) return;
    const existing = new Set(uploadItems.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
    const images = incoming.filter((item) => item.type.startsWith("image/") && item.size <= maxUploadBytes && !existing.has(`${item.name}:${item.size}:${item.lastModified}`));
    const remaining = Math.max(0, maxBatchFiles - uploadItems.length);
    const accepted = images.slice(0, remaining).map<UploadItem>((next) => ({
      id: crypto.randomUUID(),
      file: next,
      preview: URL.createObjectURL(next),
      name: next.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      category: "Outerwear",
      status: "ready",
    }));
    setUploadItems((items) => [...items, ...accepted]);
    if (fileInput.current) fileInput.current.value = "";

    const oversized = incoming.filter((item) => item.type.startsWith("image/") && item.size > maxUploadBytes).length;
    const invalid = incoming.filter((item) => !item.type.startsWith("image/")).length;
    const overflow = Math.max(0, images.length - remaining);
    const notices = [
      oversized ? `${oversized} ${oversized === 1 ? "foto supera" : "fotos superan"} 20 MB` : "",
      invalid ? `${invalid} ${invalid === 1 ? "archivo no es una imagen" : "archivos no son imágenes"}` : "",
      overflow ? `el lote admite hasta ${maxBatchFiles} prendas` : "",
    ].filter(Boolean);
    setUploadError(notices.join(" · "));
  }

  function updateUploadItem(id: string, patch: Partial<UploadItem>) {
    setUploadItems((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function removeUploadItem(id: string) {
    const item = uploadItems.find((candidate) => candidate.id === id);
    if (item?.preview.startsWith("blob:")) URL.revokeObjectURL(item.preview);
    setUploadItems((items) => items.filter((candidate) => candidate.id !== id));
    setUploadError("");
  }

  async function ghostGarments() {
    const pending = uploadItems.filter((item) => item.status === "ready" || item.status === "failed");
    if (!pending.length) return;
    setUploadingBatch(true);
    setUploadError("");
    pending.forEach((item) => updateUploadItem(item.id, { status: "uploading", error: undefined }));

    if (isStaticDemo) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      pending.forEach((item) => updateUploadItem(item.id, { status: "processing" }));
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const created = pending.map<Garment>((item) => {
        const custom = { name: item.name || "Prenda sin nombre", category: item.category, color: "Custom" };
        return { id: crypto.randomUUID(), ...custom, ...classifyGarment(custom), image: item.preview, status: "ghosted" };
      });
      setGarments((items) => [...created, ...items]);
      pending.forEach((item) => updateUploadItem(item.id, { status: "done" }));
      setUploadingBatch(false);
      return;
    }

    const remote = new Map<string, string>();
    const useDiscountedBatch = pending.length >= discountedBatchThreshold && pending.every((item) => !item.garmentId);
    let failedCount = 0;
    let waitingCount = 0;
    for (const item of pending) {
      try {
        if (item.garmentId) {
          const retryResponse = await fetch(`/api/garments/${encodeURIComponent(item.garmentId)}/retry`, { method: "POST" });
          const retryResult = await retryResponse.json().catch(() => null) as { job?: { status?: string }; error?: string } | null;
          if (!retryResponse.ok) throw new Error(retryResult?.error || "No se pudo reiniciar el recorte.");
          if (retryResult?.job?.status === "waiting_for_key") {
            waitingCount += 1;
            updateUploadItem(item.id, { status: "waiting", error: "Esperando procesamiento" });
          } else {
            remote.set(item.id, item.garmentId);
            updateUploadItem(item.id, { status: "processing", error: undefined });
          }
          continue;
        }
        const custom = { name: item.name || "Prenda sin nombre", category: item.category, color: "Custom" };
        const attributes = classifyGarment(custom);
        const processingFile = await processingFileFor(item.file);
        const body = new FormData();
        body.append("file", processingFile);
        body.append("original", item.file);
        if (useDiscountedBatch) body.append("processingMode", "batch");
        body.append("name", custom.name);
        body.append("category", item.category);
        body.append("colorFamily", attributes.colorFamily);
        body.append("tone", attributes.tone);
        body.append("material", attributes.material);
        body.append("finish", attributes.finish);
        body.append("silhouette", attributes.silhouette);
        const response = await fetch("/api/upload", { method: "POST", body });
        const result = await response.json().catch(() => null) as { garment?: ApiGarment; job?: { status?: string }; error?: string } | null;
        if (!response.ok || !result?.garment) throw new Error(result?.error || "No se pudo cargar la prenda.");
        setGarments((items) => mergeApiGarments(items, [result.garment as ApiGarment]));
        if (result.job?.status === "waiting_for_key") {
          waitingCount += 1;
          updateUploadItem(item.id, { status: "waiting", garmentId: result.garment.id, error: "Esperando procesamiento" });
        } else {
          remote.set(item.id, result.garment.id);
          updateUploadItem(item.id, { status: "processing", garmentId: result.garment.id });
        }
      } catch (error) {
        failedCount += 1;
        updateUploadItem(item.id, { status: "failed", error: error instanceof Error ? error.message : "No se pudo cargar" });
      }
    }

    if (useDiscountedBatch && remote.size > 1) {
      try {
        const batchResponse = await fetch("/api/batches", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ garmentIds: [...remote.values()] }),
        });
        const batchResult = await batchResponse.json().catch(() => null) as { batch?: { status?: string }; fallback?: string; error?: string } | null;
        if (!batchResponse.ok) throw new Error(batchResult?.error || "No se pudo crear el lote.");
        remote.forEach((_, localId) => updateUploadItem(localId, {
          status: "processing",
          error: batchResult?.fallback ? "Procesando ahora" : "Lote Low · hasta 24 h",
        }));
      } catch (error) {
        failedCount += remote.size;
        remote.forEach((_, localId) => updateUploadItem(localId, { status: "failed", error: error instanceof Error ? error.message : "El lote falló" }));
        remote.clear();
      }
    }

    let timedOut = false;
    const maxAttempts = useDiscountedBatch ? 15 : 90;
    for (let attempt = 0; attempt < maxAttempts && remote.size > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, useDiscountedBatch ? 4000 : 2000));
      if (useDiscountedBatch && attempt % 3 === 0) await fetch("/api/batches/status", { cache: "no-store" }).catch(() => null);
      const checks = await Promise.all([...remote.entries()].map(async ([localId, garmentId]) => {
        try {
          const statusResponse = await fetch(`/api/garments/${encodeURIComponent(garmentId)}/status`, { cache: "no-store" });
          const statusResult = await statusResponse.json().catch(() => null) as { garment?: ApiGarment; job?: { status?: string; error?: string }; error?: string } | null;
          return { localId, statusResponse, statusResult };
        } catch {
          return { localId, statusResponse: null, statusResult: null };
        }
      }));
      for (const { localId, statusResponse, statusResult } of checks) {
        if (!statusResponse?.ok || !statusResult?.garment) continue;
        let updatedGarment = statusResult.garment;
        if (updatedGarment.status === "cutout_pending") {
          try { updatedGarment = await finalizePendingCutouts(updatedGarment); } catch { /* It will retry on the next status pass. */ }
        }
        setGarments((items) => mergeApiGarments(items, [updatedGarment as ApiGarment]));
        if (updatedGarment.status === "ready") {
          updateUploadItem(localId, { status: "done", error: undefined });
          remote.delete(localId);
        } else if (statusResult.job?.status === "failed" || statusResult.garment.status === "failed") {
          failedCount += 1;
          updateUploadItem(localId, { status: "failed", error: statusResult.job?.error || "El recorte falló" });
          remote.delete(localId);
        }
      }
    }
    if (remote.size > 0) {
      timedOut = true;
      remote.forEach((_, localId) => updateUploadItem(localId, { status: "processing", error: "Continúa en segundo plano" }));
    }
    if (failedCount) setUploadError(`${failedCount} ${failedCount === 1 ? "prenda necesita" : "prendas necesitan"} revisión.`);
    else if (waitingCount) setUploadError(`${waitingCount} ${waitingCount === 1 ? "prenda quedó guardada" : "prendas quedaron guardadas"}; falta activar el procesamiento.`);
    else if (timedOut) setUploadError("Los recortes siguen procesándose y aparecerán en el armario al terminar.");
    setUploadingBatch(false);
  }

  function bringToFront(instanceId: string) {
    setCanvasPieces((items) => {
      const piece = items.find((item) => item.instanceId === instanceId);
      const garment = piece ? garmentById.get(piece.garmentId) : undefined;
      if (!piece || !garment) return items;
      const base = layerBase(garment.category);
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      return items.map((item) => item.instanceId === instanceId ? { ...item, z: top } : item);
    });
  }

  function addToCanvas(garmentId: string) {
    const existing = canvasPieces.find((item) => item.garmentId === garmentId);
    if (existing) {
      setSelectedId(existing.instanceId);
      bringToFront(existing.instanceId);
      setSaved(false);
      return;
    }
    const garment = garmentById.get(garmentId);
    if (!garment) return;
    const instanceId = crypto.randomUUID();
    const placement = defaultPlacement(garment);
    setCanvasPieces((items) => {
      const base = layerBase(garment.category);
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      return [...items, {
        instanceId,
        garmentId,
        variant: garment.openImage ? "open" : "closed",
        x: placement.x,
        y: placement.y,
        scale: placement.scale,
        rotation: 0,
        z: top,
      }];
    });
    setSelectedId(instanceId);
    setSaved(false);
  }

  function addAndOpenStudio(garmentId: string) {
    addToCanvas(garmentId);
    setActiveOutfitId(null);
    setActiveLookName("Nuevo look");
    setView("studio");
  }

  function startMoving(event: ReactPointerEvent<HTMLDivElement>, instanceId: string) {
    const canvas = canvasRef.current;
    const piece = canvasPieces.find((item) => item.instanceId === instanceId);
    if (!canvas || !piece) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    const track: PointerTrack = {
      instanceId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      wasSelected: selectedId === instanceId,
      startedAt: event.timeStamp,
    };
    const otherPointer = Array.from(pointerTracks.current.entries()).find(([, pointer]) => pointer.instanceId === instanceId);
    pointerTracks.current.set(event.pointerId, track);

    if (otherPointer && !pinchSession.current) {
      const [otherId, otherTrack] = otherPointer;
      otherTrack.moved = true;
      track.moved = true;
      pinchSession.current = {
        instanceId,
        pointerIds: [otherId, event.pointerId],
        startDistance: Math.hypot(event.clientX - otherTrack.x, event.clientY - otherTrack.y),
        startScale: piece.scale,
        startAngle: Math.atan2(event.clientY - otherTrack.y, event.clientX - otherTrack.x),
        startRotation: piece.rotation,
      };
      dragSession.current = null;
    } else if (!pinchSession.current) {
      dragSession.current = {
        instanceId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: piece.x,
        originY: piece.y,
        width: rect.width,
        height: rect.height,
      };
    } else {
      track.moved = true;
    }
    setSelectedId(instanceId);
    bringToFront(instanceId);
    setSaved(false);
  }

  function movePiece(event: ReactPointerEvent<HTMLDivElement>) {
    const track = pointerTracks.current.get(event.pointerId);
    if (!track) return;
    track.x = event.clientX;
    track.y = event.clientY;
    if (Math.hypot(track.x - track.startX, track.y - track.startY) > 8) track.moved = true;

    const pinch = pinchSession.current;
    if (pinch?.pointerIds.includes(event.pointerId)) {
      const first = pointerTracks.current.get(pinch.pointerIds[0]);
      const second = pointerTracks.current.get(pinch.pointerIds[1]);
      if (!first || !second || pinch.startDistance < 1) return;
      event.preventDefault();
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const scale = clamp(pinch.startScale * (distance / pinch.startDistance), 0.28, 1.35);
      const angle = Math.atan2(second.y - first.y, second.x - first.x);
      const rotation = pinch.startRotation + normalizeDegrees((angle - pinch.startAngle) * (180 / Math.PI));
      setCanvasPieces((items) => items.map((item) => item.instanceId === pinch.instanceId ? { ...item, scale, rotation } : item));
      setSaved(false);
      return;
    }

    const drag = dragSession.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const x = clamp(drag.originX + ((event.clientX - drag.startX) / drag.width) * 100, 4, 96);
    const y = clamp(drag.originY + ((event.clientY - drag.startY) / drag.height) * 100, 4, 96);
    setCanvasPieces((items) => items.map((item) => item.instanceId === drag.instanceId ? { ...item, x, y } : item));
  }

  function stopMoving(event: ReactPointerEvent<HTMLDivElement>, cancelled = false) {
    const track = pointerTracks.current.get(event.pointerId);
    const pinch = pinchSession.current;
    const wasPinching = Boolean(pinch?.pointerIds.includes(event.pointerId));

    if (wasPinching && pinch) {
      const remainingId = pinch.pointerIds.find((pointerId) => pointerId !== event.pointerId);
      const remaining = remainingId === undefined ? undefined : pointerTracks.current.get(remainingId);
      if (remaining) remaining.moved = true;
      pinchSession.current = null;
    }
    if (dragSession.current?.pointerId === event.pointerId) dragSession.current = null;
    pointerTracks.current.delete(event.pointerId);

    if (!cancelled && !wasPinching && track && !track.moved) {
      const held = event.timeStamp - track.startedAt >= 500;
      const piece = canvasPieces.find((item) => item.instanceId === track.instanceId);
      const garment = piece ? garmentById.get(piece.garmentId) : undefined;
      if (held && garment?.openImage) {
        toggleVariant(track.instanceId);
      } else if (track.wasSelected) {
        removePiece(track.instanceId);
      }
    }
  }

  function toggleVariant(instanceId: string) {
    setCanvasPieces((items) => items.map((item) => item.instanceId === instanceId
      ? { ...item, variant: item.variant === "open" ? "closed" : "open" }
      : item));
    setSaved(false);
  }

  function updateSelected(patch: Partial<CanvasPiece>) {
    if (!selectedId) return;
    setCanvasPieces((items) => items.map((item) => item.instanceId === selectedId ? { ...item, ...patch } : item));
    setSaved(false);
  }

  function scaleSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ scale: clamp(selectedPiece.scale + delta, 0.24, 1.15) });
  }

  function rotateSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ rotation: selectedPiece.rotation + delta });
  }

  function sendSelected(direction: "front" | "back") {
    if (!selectedPiece || !selectedGarment) return;
    const base = layerBase(selectedGarment.category);
    const levels = canvasPieces.filter((item) => {
      const garment = garmentById.get(item.garmentId);
      return garment && layerBase(garment.category) === base;
    }).map((item) => item.z);
    updateSelected({ z: direction === "front" ? Math.max(base, ...levels) + 1 : Math.max(base, Math.min(...levels) - 1) });
  }

  function removePiece(instanceId: string) {
    setCanvasPieces((items) => items.filter((item) => item.instanceId !== instanceId));
    setSelectedId((current) => current === instanceId ? "" : current);
    setSaved(false);
  }

  function removeSelected() {
    if (selectedId) removePiece(selectedId);
  }

  function recommendStyle() {
    const next = demoMode
      ? buildDemoRecommendations(styleCode, styleMoment, styleOccasion)
      : buildStylingRecommendations(garments, styleCode, styleMoment, styleOccasion);
    if (!next.length) {
      setWardrobeError("Faltan prendas compatibles para crear esta recomendación.");
      return;
    }
    setStylingRecommendations(next);
    setWardrobeError("");
  }

  function iterateCurrentLook() {
    const next = buildLookIterations(garments, canvasPieces);
    if (!next.length) {
      setWardrobeError("Añade por lo menos un top y un pantalón para crear cinco variaciones.");
      return;
    }
    setLookIterations(next);
    setLibraryOpen(false);
    setWardrobeError("");
  }

  function openLookIteration(iteration: LookIteration) {
    setCanvasPieces(iteration.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })));
    setSelectedId("");
    setActiveOutfitId(null);
    setActiveLookName(iteration.title);
    setSaved(false);
    setLookIterations([]);
    setWardrobeError("");
  }

  function openStylingRecommendation(recommendation: StylingRecommendation) {
    setCanvasPieces(recommendation.items.map((item) => ({ ...item, instanceId: crypto.randomUUID() })));
    setSelectedId("");
    setActiveOutfitId(null);
    setActiveLookName(recommendation.name);
    setSaved(false);
    setLookIterations([]);
    setLibraryOpen(false);
    setWardrobeError("");
    setView("studio");
  }

  function openSavedLook(look: SavedLook) {
    setCanvasPieces(look.items.map((item) => normalizedCanvasPiece({ ...item }, garmentById.get(item.garmentId))));
    setSelectedId("");
    setActiveOutfitId(look.id);
    setActiveLookName(look.name);
    setSaved(true);
    setLookIterations([]);
    setLibraryOpen(false);
    setView("studio");
  }

  async function deleteSavedLook(lookId: string) {
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(lookId)}`, { method: "DELETE" });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo eliminar el look.");
      }
      setSavedLooks((looks) => {
        const nextLooks = looks.filter((look) => look.id !== lookId);
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      if (activeOutfitId === lookId) {
        setActiveOutfitId(null);
        setActiveLookName("Nuevo look");
        setSaved(false);
      }
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo eliminar el look.");
    }
  }

  async function saveCurrentOutfit() {
    if (canvasPieces.length === 0) return;
    const outfitId = activeOutfitId ?? `look-${crypto.randomUUID()}`;
    const fallbackName = `Look ${String(savedLooks.length + 1).padStart(2, "0")}`;
    const lookName = activeLookName === "Nuevo look" || activeLookName === "Conjunto actual" ? fallbackName : activeLookName;
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      if (!isStaticDemo && !demoMode) {
        const response = await fetch(`/api/outfits/${encodeURIComponent(outfitId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: lookName, items: canvasPieces }),
        });
        if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo guardar el conjunto.");
      }
      const nextLook: SavedLook = { id: outfitId, name: lookName, items: canvasPieces.map((item) => ({ ...item })) };
      setSavedLooks((looks) => {
        const nextLooks = [nextLook, ...looks.filter((look) => look.id !== outfitId)];
        if (demoMode) localStorage.setItem(demoLooksStorageKey, JSON.stringify(nextLooks));
        return nextLooks;
      });
      setActiveOutfitId(null);
      setActiveLookName("Nuevo look");
      setSaved(true);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar el conjunto.");
    } finally {
      setSavingOutfit(false);
    }
  }

  async function retryProcessing(item: Garment, quality: "low" | "medium" = "low", outputVariant: "closed" | "open" = "closed") {
    setGarmentSaveError("");
    setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "queued" } : garment));
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}/retry`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quality, outputVariant, presentation: outputVariant === "open" ? "open" : "closed" }),
      });
      const result = await response.json().catch(() => null) as { job?: { status?: string }; error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "No se pudo reiniciar el procesamiento.");
      if (result?.job?.status === "waiting_for_key") throw new Error("Falta conectar la clave de procesamiento.");
      setGarmentDraft(null);
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`/api/garments/${encodeURIComponent(item.id)}/status`, { cache: "no-store" });
        const statusResult = await statusResponse.json().catch(() => null) as { garment?: ApiGarment; job?: { error?: string; status?: string } } | null;
        if (!statusResponse.ok || !statusResult?.garment) throw new Error("No se pudo revisar el recorte.");
        let updatedGarment = statusResult.garment;
        if (updatedGarment.status === "cutout_pending") updatedGarment = await finalizePendingCutouts(updatedGarment);
        setGarments((items) => mergeApiGarments(items, [updatedGarment as ApiGarment]));
        if (updatedGarment.status === "ready") return;
        if (updatedGarment.status === "failed") throw new Error(statusResult.job?.error || "El recorte volvió a fallar.");
      }
    } catch (error) {
      setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "failed" } : garment));
      setWardrobeError(error instanceof Error ? error.message : "No se pudo reiniciar el procesamiento.");
    }
  }

  if (isStaticDemo) {
    return <main className="static-redirect" aria-live="polite">
      <p>ABRIENDO FORME</p>
      <h1>Tu armario continúa en la app operativa.</h1>
      <a href={operationalSiteUrl}>CONTINUAR →</a>
    </main>;
  }

  return (
    <main className={`site-shell view-${view}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => openWardrobe(demoMode ? "basics" : "pieces")} aria-label="Ir al armario">FORME<span>®</span></button>
        <nav className="zone-nav" aria-label="Secciones principales">
          <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe(demoMode ? "basics" : "pieces")}>Armario</button>
          <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}>Canvas</button>
        </nav>
        {demoMode
          ? <button className="google-login" onClick={beginGoogleSignIn} disabled={sessionStatus === "checking"}><span>G</span>{sessionStatus === "checking" ? "REVISANDO SESIÓN" : "CONTINUAR CON GOOGLE"}</button>
          : <button className="avatar" onClick={() => openWardrobe()} aria-label="Abrir mi perfil"><img className={profileImageClass} src={profileImage} alt="" /></button>}
      </header>

      {view === "wardrobe" && (
        <section className="content wardrobe-view">
          <section className="wardrobe-profile">
            <div className="profile-identity">
              {demoMode
                ? <span className="profile-avatar demo-avatar">F</span>
                : <span className="profile-avatar"><img className={profileImageClass} src={profileImage} alt={`Foto de perfil de ${profile.name}`} /></span>}
              <div><p>{demoMode ? "CLOSET DE PRUEBA" : "MI ARMARIO"}</p><h1>{demoMode ? "Básicos FORME" : profile.name}</h1><span>{demoMode ? "Prueba ahora · inicia sesión para subir el tuyo" : profile.handle}</span></div>
            </div>
            <div className="profile-stats">
              <p><strong>{personalGarments.length}</strong><span>Mis prendas</span></p>
              <p><strong>{sharedBasics.length}</strong><span>Básicos</span></p>
              <p><strong>{savedLooks.length}</strong><span>Looks</span></p>
            </div>
            <nav className="wardrobe-tabs" aria-label="Mi armario">
              {!demoMode && <button className={wardrobePanel === "pieces" ? "active" : ""} onClick={() => setWardrobePanel("pieces")}>Mis prendas</button>}
              <button className={wardrobePanel === "basics" || demoMode && wardrobePanel === "pieces" ? "active" : ""} onClick={() => setWardrobePanel("basics")}>Básicos FORME</button>
              <button className={wardrobePanel === "looks" ? "active" : ""} onClick={() => setWardrobePanel("looks")}>Looks guardados</button>
              {demoMode
                ? <button onClick={beginGoogleSignIn}>＋ Añadir mis prendas</button>
                : <button className={wardrobePanel === "upload" ? "active" : ""} onClick={() => setWardrobePanel("upload")}>＋ Añadir prenda</button>}
            </nav>
          </section>
          {wardrobeError && <div className="app-message error" role="status">{wardrobeError}<button onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}

          {wardrobePanel === "pieces" || wardrobePanel === "basics" ? (
            <section className="pieces-section">
              <div className="catalog-toolbar">
                <div><p>{wardrobePanel === "basics" || demoMode ? "BIBLIOTECA COMPARTIDA" : "COLECCIÓN"}</p><h2>{wardrobePanel === "basics" || demoMode ? "Básicos FORME" : "Mis prendas"}</h2></div>
                <div><span>{visible.length} de {catalogGarments.length}</span><button className={filtersOpen || archiveFilterCount > 0 ? "active" : ""} onClick={() => setFiltersOpen((open) => !open)}>Filtros{archiveFilterCount > 0 ? ` · ${archiveFilterCount}` : ""}</button></div>
              </div>
              <div className={`wardrobe-catalog ${filtersOpen ? "filters-open" : ""}`}>
                <aside className={`filter-sidebar ${filtersOpen ? "open" : ""}`}>
                  <div className="filter-sidebar-header"><strong>Filtros</strong><button onClick={() => setFiltersOpen(false)} aria-label="Cerrar filtros">×</button></div>
                  <AttributeFilters value={archiveFilters} options={filterOptions} onChange={updateArchiveFilter} onReset={() => setArchiveFilters(emptyFilters)} />
                </aside>
                <div className="catalog-results">
                  <div className="garment-grid">
                    {visible.map((item) => (
                      <article className="garment-card" key={item.id}>
                        <div className="image-wrap">
                          <img src={imageSrc(item.image)} alt={translateGarmentName(item.name)} loading="lazy" />
                          {(["queued", "processing", "uploaded", "batch_staged", "batch_processing", "cutout_pending"] as Garment["status"][]).includes(item.status) && <span className="processing-badge">{item.status.startsWith("batch") ? "LOTE LOW EN PROCESO" : item.status === "cutout_pending" ? "TERMINANDO BORDE" : "PREPARANDO RECORTE"}</span>}
                          {item.status === "failed" && <span className="processing-badge failed">REVISAR RECORTE</span>}
                          <button className="card-detail-open" onClick={() => item.collection === "forme" ? addAndOpenStudio(item.id) : openGarmentEditor(item)} aria-label={`${item.collection === "forme" ? "Probar" : "Abrir ficha de"} ${translateGarmentName(item.name)}`}><span>{item.collection === "forme" ? "PROBAR EN CANVAS ↗" : "VER FICHA ↗"}</span></button>
                          {item.collection !== "forme" && <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => toggleFavorite(item)} aria-label={`${item.favorite ? "Quitar de" : "Añadir a"} favoritas: ${translateGarmentName(item.name)}`}>♥</button>}
                          <button className="card-studio-add" onClick={() => addAndOpenStudio(item.id)}>AÑADIR AL CANVAS <span>＋</span></button>
                        </div>
                        <button className="card-meta" onClick={() => item.collection === "forme" ? addAndOpenStudio(item.id) : openGarmentEditor(item)} aria-label={`${item.collection === "forme" ? "Probar" : "Editar"} ${translateGarmentName(item.name)}`}><span><strong>{translateGarmentName(item.name)}</strong><small>{item.collection === "forme" ? "FORME · " : item.brand ? `${item.brand} · ` : ""}{translateValue(item.category)} · {translateValue(item.tone)}</small></span><b>↗</b></button>
                      </article>
                    ))}
                    {visible.length === 0 && <div className="filter-empty">NO HAY PRENDAS<button onClick={() => setArchiveFilters(emptyFilters)}>LIMPIAR FILTROS</button></div>}
                  </div>
                </div>
              </div>
            </section>
          ) : wardrobePanel === "looks" ? (
            <section className="looks-view">
              <div className="style-wheel">
                <div className="style-wheel-copy">
                  <p>ASISTENTE DE STYLING</p>
                  <h2>¿Para qué te estás vistiendo?</h2>
                  <span>{demoMode ? "Explora tres combinaciones coherentes usando la biblioteca compartida. Después puedes reemplazar cada básico por una prenda tuya." : "FORME analiza contexto, dress code, color, materiales y proporción. Después propone tres caminos usando únicamente tu armario."}</span>
                </div>
                <div className="style-wheel-controls">
                  <fieldset className="option-four">
                    <legend>PLAN</legend>
                    {(Object.keys(styleOccasionLabels) as StyleOccasion[]).map((option) => <button type="button" className={styleOccasion === option ? "active" : ""} onClick={() => { setStyleOccasion(option); setStylingRecommendations([]); }} key={option}>{styleOccasionLabels[option]}</button>)}
                  </fieldset>
                  <fieldset className="option-four">
                    <legend>DRESS CODE</legend>
                    {(Object.keys(styleCodeLabels) as StyleCode[]).map((option) => <button type="button" className={styleCode === option ? "active" : ""} onClick={() => { setStyleCode(option); setStylingRecommendations([]); }} key={option}>{styleCodeLabels[option]}</button>)}
                  </fieldset>
                  <fieldset>
                    <legend>MOMENTO</legend>
                    {(Object.keys(styleMomentLabels) as StyleMoment[]).map((option) => <button type="button" className={styleMoment === option ? "active" : ""} onClick={() => { setStyleMoment(option); setStylingRecommendations([]); }} key={option}>{styleMomentLabels[option]}</button>)}
                  </fieldset>
                  <button className="style-spin" type="button" onClick={recommendStyle}><span>ANALIZAR MI ARMARIO</span><b>→</b></button>
                </div>
              </div>

              {stylingRecommendations.length > 0 && <section className="styling-results" aria-live="polite">
                <div className="styling-results-heading">
                  <div><p>ANÁLISIS COMPLETO</p><h2>Tres direcciones que sí funcionan</h2></div>
                  <span>{styleOccasionLabels[styleOccasion]} · {styleCodeLabels[styleCode]} · {styleMomentLabels[styleMoment]}</span>
                </div>
                <div className="styling-recommendation-grid">
                  {stylingRecommendations.map((recommendation, index) => (
                    <article className="styling-recommendation" key={recommendation.id}>
                      <LookPreview look={{ id: recommendation.id, name: recommendation.name, items: recommendation.items }} garmentById={garmentById} />
                      <div className="styling-recommendation-copy">
                        <span>0{index + 1} / {recommendation.title.toLocaleUpperCase()}</span>
                        <h3>{recommendation.name}</h3>
                        <p>{recommendation.reason}</p>
                        <button type="button" onClick={() => openStylingRecommendation(recommendation)}>PROBAR EN CANVAS <b>↗</b></button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>}

              <div className="saved-looks-heading">
                <div><p>ARCHIVO PERSONAL</p><h2>Looks guardados</h2></div>
                <span>{savedLooks.length} {savedLooks.length === 1 ? "LOOK" : "LOOKS"}</span>
              </div>
              <div className="saved-looks-grid">
                {savedLooks.map((look) => (
                  <article className="saved-look-card" key={look.id}>
                    <button className="saved-look-open" type="button" onClick={() => openSavedLook(look)} aria-label={`Abrir ${look.name} en el canvas`}>
                      <LookPreview look={look} garmentById={garmentById} />
                      <span>ABRIR EN CANVAS ↗</span>
                    </button>
                    <div className="saved-look-meta">
                      <div><strong>{look.name}</strong><small>{look.items.length} PIEZAS</small></div>
                      <button type="button" onClick={() => deleteSavedLook(look.id)} aria-label={`Eliminar ${look.name}`}>ELIMINAR</button>
                    </div>
                  </article>
                ))}
                {savedLooks.length === 0 && <div className="looks-empty"><p>Todavía no guardaste ningún look.</p><button type="button" onClick={recommendStyle}>ANALIZAR MI ARMARIO →</button></div>}
              </div>
            </section>
          ) : (
            <section className="upload-view">
              <div className="upload-heading"><p>NUEVAS PRENDAS</p><h2>Añadir al armario</h2></div>
              <div className="upload-layout">
                <label
                  className={`dropzone bulk-dropzone ${uploadItems.length ? "has-files" : ""} ${draggingUpload ? "dragging" : ""}`}
                  onDragEnter={(event: DragEvent) => { event.preventDefault(); setDraggingUpload(true); }}
                  onDragOver={(event: DragEvent) => event.preventDefault()}
                  onDragLeave={() => setDraggingUpload(false)}
                  onDrop={(event) => { event.preventDefault(); setDraggingUpload(false); acceptFiles(event.dataTransfer.files); }}
                >
                  <input ref={fileInput} type="file" accept="image/*" multiple onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFiles(event.target.files ?? undefined)} hidden />
                  {uploadItems.length > 0
                    ? <div className="upload-preview-grid">{uploadItems.map((item) => <img src={item.preview} alt="" key={item.id} />)}</div>
                    : <div className="dropzone-empty"><span className="upload-icon" aria-hidden="true">↑</span><h3>Arrastra tus fotos aquí</h3><p>o toca para seleccionar</p><small>HASTA {maxBatchFiles} PRENDAS · 20 MB C/U</small></div>}
                  {uploadItems.length > 0 && !uploadingBatch && <span className="replace-photo">AÑADIR MÁS · {uploadItems.length}/{maxBatchFiles}</span>}
                </label>
                <div className="intake-panel bulk-intake">
                  <div className="batch-heading"><span>LOTE</span><strong>{uploadItems.length ? `${uploadItems.length} ${uploadItems.length === 1 ? "PRENDA" : "PRENDAS"}` : "SIN PRENDAS"}</strong></div>
                  {uploadItems.length > 0
                    ? <div className="upload-queue">{uploadItems.map((item, index) => {
                      const editable = !uploadingBatch && (item.status === "ready" || item.status === "failed");
                      return <article className={`upload-item status-${item.status}`} key={item.id}>
                        <img className="upload-item-thumb" src={item.preview} alt="" />
                        <div className="upload-item-fields">
                          <label>NOMBRE<input disabled={!editable} value={item.name} onChange={(event) => updateUploadItem(item.id, { name: event.target.value })} placeholder={`Prenda ${index + 1}`} /></label>
                          <label>TIPO<select disabled={!editable} value={item.category} onChange={(event) => updateUploadItem(item.id, { category: event.target.value as Garment["category"] })}><option value="Outerwear">Abrigos</option><option value="Tops">Prendas superiores</option><option value="Bottoms">Pantalones</option><option value="Tailoring">Sastrería</option><option value="Footwear">Calzado</option><option value="Accessories">Accesorios</option></select></label>
                          <span className="upload-item-state">{uploadStatusLabels[item.status]}{item.error ? ` · ${item.error}` : ""}</span>
                        </div>
                        {editable && <button className="remove-upload-item" type="button" onClick={() => removeUploadItem(item.id)} aria-label={`Quitar ${item.name || `prenda ${index + 1}`}`}>×</button>}
                      </article>;
                    })}</div>
                    : <div className="queue-empty"><p>Selecciona varias fotos y corrige el nombre o tipo antes de procesarlas.</p></div>}
                  {uploadError && <p className={`upload-status ${uploadItems.some((item) => item.status === "failed") ? "error" : ""}`}>{uploadError}</p>}
                  {uploadItems.length > 0 && uploadRetryableCount === 0 && !uploadingBatch
                    ? <button className="primary-action ready" onClick={() => { resetUpload(); setWardrobePanel("pieces"); }}>VER EN MI ARMARIO <span>→</span></button>
                    : <button className="primary-action" disabled={uploadRetryableCount === 0 || uploadingBatch} onClick={ghostGarments}>{uploadingBatch ? `PROCESANDO ${uploadFinishedCount} DE ${uploadItems.length}` : uploadItems.some((item) => item.status === "failed") ? `REINTENTAR ${uploadRetryableCount}` : `CREAR ${uploadRetryableCount} ${uploadRetryableCount === 1 ? "RECORTE" : "RECORTES"}`}<span>→</span></button>}
                </div>
              </div>
            </section>
          )}
        </section>
      )}

      {view === "studio" && (
        <section className="content studio-view">
          <div className="section-line"><h2>CANVAS</h2><p>{canvasPieces.length} PIEZAS</p></div>
          <div className="studio-layout">
            <div className="canvas-column">
              <div className="look-canvas" ref={canvasRef}>
                <p className="look-date">{activeLookName.toLocaleUpperCase()} / ARRASTRA · PELLIZCA · GIRA</p>
                <span className="canvas-hint">MANTÉN = ABRIR / CERRAR</span>
                {canvasPieces.length === 0 && <button className="empty-canvas" onClick={() => setLibraryOpen(true)}>TU CANVAS ESTÁ VACÍO<br /><span>ABRIR ARMARIO ＋</span></button>}
                {canvasPieces.map((piece) => {
                  const garment = garmentById.get(piece.garmentId);
                  if (!garment) return null;
                  const pieceImage = piece.variant === "open" && garment.openImage ? garment.openImage : garment.image;
                  const canvasImage = cleanCanvasImage(pieceImage);
                  return (
                    <div
                      className={`canvas-piece ${selectedId === piece.instanceId ? "selected" : ""}`}
                      key={piece.instanceId}
                      onPointerDown={(event) => startMoving(event, piece.instanceId)}
                      onPointerMove={movePiece}
                      onPointerUp={stopMoving}
                      onPointerCancel={(event) => stopMoving(event, true)}
                      style={{
                        left: `${piece.x}%`,
                        top: `${piece.y}%`,
                        zIndex: piece.z,
                        transform: `translate(-50%, -50%) rotate(${piece.rotation}deg) scale(${piece.scale})`,
                      }}
                    >
                      <img src={imageSrc(canvasImage)} alt={translateGarmentName(garment.name)} draggable={false} />
                    </div>
                  );
                })}
                {lookIterations.length > 0 && (
                  <section className="iteration-drawer" aria-label="Cinco variaciones del look">
                    <header><div><span>ITERAR LOOK</span><strong>5 variaciones · {iterationBaseCount} piezas fijas</strong></div><button type="button" onClick={() => setLookIterations([])} aria-label="Cerrar variaciones">×</button></header>
                    <div className="iteration-list">
                      {lookIterations.map((iteration, index) => (
                        <button type="button" className="iteration-card" onClick={() => openLookIteration(iteration)} key={iteration.id}>
                          <LookPreview look={{ id: iteration.id, name: iteration.title, items: iteration.items }} garmentById={garmentById} />
                          <span>0{index + 1}</span><strong>{iteration.title}</strong><small>{iteration.detail}</small>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <button className={`floating-panel-toggle library-panel-toggle ${libraryOpen ? "active" : ""}`} onClick={() => setLibraryOpen((open) => !open)} aria-expanded={libraryOpen} aria-label="Abrir armario">
              <span>ARMARIO</span><b>{libraryOpen ? "×" : "＋"}</b>
            </button>

            <div className={`look-controls ${libraryOpen ? "panel-open" : "panel-closed"}`}>
              <div className="floating-panel-header"><span>{demoMode ? "BÁSICOS FORME" : "ARMARIO"} / {String(studioGarments.length).padStart(2, "0")}</span><button onClick={() => setLibraryOpen(false)} aria-label="Cerrar armario">×</button></div>
              <div className="studio-library-filters" aria-label="Filtrar biblioteca del canvas">
                {([
                  ["all", "Todo"],
                  ...(demoMode ? [] : [["personal", "Mío"]]),
                  ["forme", "FORME"],
                  ["footwear", "Calzado"],
                  ["accessories", "Accesorios"],
                ] as [StudioLibraryFilter, string][]).map(([value, label]) => <button type="button" className={studioLibraryFilter === value ? "active" : ""} onClick={() => setStudioLibraryFilter(value)} key={value}>{label}</button>)}
              </div>
              <div className="selected-readout">
                <p>PIEZA SELECCIONADA</p>
                <h3>{selectedGarment ? translateGarmentName(selectedGarment.name) : "Toca una prenda"}</h3>
                <small>{selectedGarment ? translateValue(selectedGarment.category) : "Selecciona una pieza del canvas"}</small>
                {selectedPiece && <button onClick={() => sendSelected("back")}>ENVIAR ATRÁS ↓</button>}
              </div>
              <div className="canvas-tools" aria-label="Controles de la prenda seleccionada">
                <button disabled={!selectedPiece} onClick={() => scaleSelected(-0.06)} aria-label="Reducir prenda"><span>−</span><em>TAMAÑO</em></button>
                <button disabled={!selectedPiece} onClick={() => scaleSelected(0.06)} aria-label="Aumentar prenda"><span>＋</span><em>TAMAÑO</em></button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(-8)} aria-label="Girar a la izquierda"><span>↺</span><em>GIRAR</em></button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(8)} aria-label="Girar a la derecha"><span>↻</span><em>GIRAR</em></button>
                <button disabled={!selectedPiece} onClick={() => sendSelected("front")} aria-label="Traer al frente"><span>↑</span><em>FRENTE</em></button>
                <button disabled={!selectedPiece} onClick={removeSelected} className="remove-tool" aria-label="Quitar prenda"><span>×</span><em>QUITAR</em></button>
              </div>

              <div className="tray-heading"><h3>PIEZAS</h3><p>TOCA PARA AÑADIR</p></div>
              <div className="sticker-tray">
                {studioGarments.map((item) => (
                  <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Añadir ${translateGarmentName(item.name)} al canvas`}>
                    <img src={imageSrc(item.image)} alt="" loading="lazy" />
                    <span>{translateGarmentName(item.name)}</span>
                  </button>
                ))}
              </div>

              <div className="studio-actions">
                <button className="iterate-look" onClick={iterateCurrentLook} disabled={!canIterate}>ITERAR ESTE LOOK · 5 <span>↻</span></button>
                <button className="shuffle" onClick={() => openWardrobe("looks")}>RECOMENDACIONES <span>→</span></button>
                <button className="clear-look" onClick={() => { setCanvasPieces([]); setSelectedId(""); setActiveOutfitId(null); setActiveLookName("Nuevo look"); setSaved(false); setLookIterations([]); }}>VACIAR</button>
              </div>
              {wardrobeError && <div className="panel-error" role="status">{wardrobeError}</div>}
              <button className={`primary-action ${saved ? "ready" : ""}`} disabled={canvasPieces.length === 0 || savingOutfit || saved} onClick={saveCurrentOutfit}>{saved ? "LOOK GUARDADO" : savingOutfit ? "GUARDANDO…" : activeOutfitId ? "GUARDAR CAMBIOS" : "GUARDAR LOOK"}<span>{saved ? "✓" : "＋"}</span></button>
            </div>
          </div>
        </section>
      )}

      {garmentDraft && editingGarment && (
        <div className="garment-editor-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGarmentDraft(null); }}>
          <section className="garment-editor" role="dialog" aria-modal="true" aria-labelledby="garment-editor-title">
            <header className="garment-editor-header">
              <span>FICHA DE PRENDA / {editingGarment.id.replace("archive-", "").toUpperCase()}</span>
              <button type="button" onClick={() => setGarmentDraft(null)} aria-label="Cerrar ficha">×</button>
            </header>
            <div className="garment-editor-body">
              <div className="garment-editor-visual">
                <div className="garment-editor-image"><img src={imageSrc(editingGarment.image)} alt={garmentDraft.name} /></div>
                <div className="garment-tag-preview" aria-label="Etiquetas actuales">
                  {[garmentDraft.category, garmentDraft.tone, garmentDraft.material, garmentDraft.finish, garmentDraft.silhouette].map((tag) => <span key={tag}>{translateValue(tag)}</span>)}
                  {garmentDraft.tags.map((tag) => <span key={tag}>#{tag}</span>)}
                </div>
                <button className="editor-canvas-add" type="button" onClick={() => { addAndOpenStudio(editingGarment.id); setGarmentDraft(null); }}>AÑADIR AL CANVAS <span>＋</span></button>
              </div>

              <form className="garment-editor-form" onSubmit={(event) => { event.preventDefault(); saveGarmentDraft(); }}>
                <div className="garment-editor-intro">
                  <p>INFORMACIÓN</p>
                  <h2 id="garment-editor-title">{garmentDraft.name || "Prenda sin nombre"}</h2>
                  <span>Corrige la ficha cuando quieras. Los cambios se guardan {isStaticDemo ? "en este dispositivo" : "en tu cuenta"}.</span>
                </div>
                <div className="garment-editor-fields">
                  <label className="field-wide">NOMBRE<input value={garmentDraft.name} onChange={(event) => updateGarmentDraft("name", event.target.value)} /></label>
                  <label>MARCA<input value={garmentDraft.brand} onChange={(event) => updateGarmentDraft("brand", event.target.value)} placeholder="Sin marca" /></label>
                  <label>TIPO<select value={garmentDraft.category} onChange={(event) => updateGarmentDraft("category", event.target.value as Garment["category"])}>{filterOptions.category.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>COLOR<select value={garmentDraft.colorFamily} onChange={(event) => { const next = event.target.value; updateGarmentDraft("colorFamily", next); updateGarmentDraft("tone", filterOptions.tonesByColor[next]?.[0] ?? "Unclassified"); }}>{filterOptions.colorFamily.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>TONO<select value={garmentDraft.tone} onChange={(event) => updateGarmentDraft("tone", event.target.value)}>{editorTones.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>MATERIAL<select value={garmentDraft.material} onChange={(event) => updateGarmentDraft("material", event.target.value)}>{filterOptions.material.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>ACABADO<select value={garmentDraft.finish} onChange={(event) => updateGarmentDraft("finish", event.target.value)}>{filterOptions.finish.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                  <label>CORTE<select value={garmentDraft.silhouette} onChange={(event) => updateGarmentDraft("silhouette", event.target.value)}>{filterOptions.silhouette.map((option) => <option value={option} key={option}>{translateValue(option)}</option>)}</select></label>
                </div>

                <div className="custom-tag-editor">
                  <div><span>ETIQUETAS</span><small>Agrega tu propia forma de organizarla.</small></div>
                  {garmentDraft.tags.length > 0 && <div className="custom-tag-list">{garmentDraft.tags.map((tag) => <button type="button" key={tag} onClick={() => updateGarmentDraft("tags", garmentDraft.tags.filter((item) => item !== tag))}>#{tag}<span>×</span></button>)}</div>}
                  <div className="tag-input-row"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={handleTagKeyDown} placeholder="viaje, noche, favorito…" /><button type="button" onClick={addDraftTag} disabled={!tagInput.trim()}>AÑADIR ＋</button></div>
                </div>

                {editingGarment.originalImage && !isStaticDemo && <details className="processing-options">
                  <summary>OPCIONES DE PROCESAMIENTO</summary>
                  <div>
                    <p>Generada en <strong>{(editingGarment.quality || "low").toLocaleUpperCase()}</strong> · Control de borde: <strong>{editingGarment.qaStatus === "review" ? "REVISAR" : editingGarment.qaStatus === "passed" ? "OK" : "PENDIENTE"}</strong></p>
                    {editingGarment.qaNotes && <small>{editingGarment.qaNotes}</small>}
                    <div className="processing-option-actions">
                      <button type="button" onClick={() => retryProcessing(editingGarment, "medium", "closed")}>REHACER EN MEDIUM</button>
                      {editingGarment.category === "Outerwear" && !editingGarment.openImage && <button type="button" onClick={() => retryProcessing(editingGarment, "low", "open")}>CREAR VERSIÓN ABIERTA</button>}
                      {editingGarment.category === "Outerwear" && editingGarment.openImage && <button type="button" onClick={() => retryProcessing(editingGarment, "medium", "open")}>ABIERTA EN MEDIUM</button>}
                    </div>
                  </div>
                </details>}

                <div className="garment-editor-actions">
                  <button type="button" className="delete-garment" onClick={() => deleteGarment(editingGarment)}>ELIMINAR</button>
                  {(editingGarment.status === "failed" || editingGarment.status === "uploaded") && !isStaticDemo && <button type="button" onClick={() => retryProcessing(editingGarment)}>REPROCESAR</button>}
                  {garmentSaveError && <span className="garment-save-error">{garmentSaveError}</span>}
                  <button type="button" onClick={() => setGarmentDraft(null)}>CANCELAR</button>
                  <button type="submit" className={garmentSaved ? "saved" : ""}>{garmentSaved ? "GUARDADO ✓" : "GUARDAR CAMBIOS"}</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Secciones principales">
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe(demoMode ? "basics" : "pieces")}><span>▦</span>Armario</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><span>◫</span>Canvas</button>
      </nav>
    </main>
  );
}
