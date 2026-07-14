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
import { classifyGarment, Garment, starterGarments } from "./garments";

type View = "wardrobe" | "studio";
type WardrobePanel = "pieces" | "upload";
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
  originalImage?: string;
  openImage?: string;
};
type WardrobeProfile = { name: string; handle: string; avatarUrl?: string | null };
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

const emptyFilters: WardrobeFilters = {
  category: "All",
  colorFamily: "All",
  tone: "All",
  material: "All",
  finish: "All",
  silhouette: "All",
};

const garmentEditsStorageKey = "forme-garment-edits-v1";
const isStaticDemo = process.env.NEXT_PUBLIC_STATIC_DEMO === "1";
const currentOutfitId = "current-look";
const maxBatchFiles = 12;
const maxUploadBytes = 20 * 1024 * 1024;
const uploadStatusLabels: Record<UploadStatus, string> = {
  ready: "LISTA",
  uploading: "SUBIENDO",
  processing: "CREANDO RECORTE",
  done: "TERMINADA",
  waiting: "GUARDADA",
  failed: "REVISAR",
};

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
const layerBase = (category: Garment["category"]) => category === "Bottoms" ? 1000 : category === "Tops" ? 2000 : 3000;
const defaultPlacement = (garment: Garment) => {
  if (garment.category === "Bottoms") {
    const scale = garment.silhouette === "Oversized" ? 0.68 : garment.silhouette === "Relaxed" ? 0.71 : 0.73;
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

const initialCanvas: CanvasPiece[] = [
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.73, rotation: 0, z: 1001 },
  { instanceId: "initial-tee", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 31.5, scale: 0.48, rotation: 0, z: 2001 },
  { instanceId: "initial-jacket", garmentId: "archive-002", variant: "open", x: 50, y: 32.5, scale: 0.51, rotation: 0, z: 3001 },
];

export default function Home() {
  const [view, setView] = useState<View>("wardrobe");
  const [wardrobePanel, setWardrobePanel] = useState<WardrobePanel>("pieces");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [garments, setGarments] = useState(starterGarments);
  const [archiveFilters, setArchiveFilters] = useState<WardrobeFilters>(emptyFilters);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [uploadingBatch, setUploadingBatch] = useState(false);
  const [draggingUpload, setDraggingUpload] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [wardrobeError, setWardrobeError] = useState("");
  const [profile, setProfile] = useState<WardrobeProfile>({ name: "Tata", handle: "@tataportal" });
  const [canvasPieces, setCanvasPieces] = useState(initialCanvas);
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
  const visible = garments.filter((item) => matchFilters(item, archiveFilters));
  const selectedPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;
  const favoriteCount = garments.filter((item) => item.favorite).length;
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
    if (!isStaticDemo) {
      let active = true;
      Promise.all([
        fetch("/api/wardrobe", { cache: "no-store" }),
        fetch("/api/outfits", { cache: "no-store" }),
        fetch("/api/session", { cache: "no-store" }),
      ])
        .then(async ([wardrobeResponse, outfitsResponse, sessionResponse]) => {
          if (!wardrobeResponse.ok) throw new Error((await wardrobeResponse.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo abrir tu armario.");
          const wardrobe = await wardrobeResponse.json() as { garments: ApiGarment[] };
          const outfits = outfitsResponse.ok
            ? await outfitsResponse.json() as { outfits: Array<{ id: string; items: CanvasPiece[] }> }
            : { outfits: [] };
          const session = sessionResponse.ok
            ? await sessionResponse.json() as { user: WardrobeProfile }
            : null;
          return { wardrobe, outfits, session };
        })
        .then(({ wardrobe, outfits, session }) => {
          if (!active) return;
          setGarments((items) => mergeApiGarments(items, wardrobe.garments));
          if (session?.user) setProfile(session.user);
          const savedLook = outfits.outfits.find((outfit) => outfit.id === currentOutfitId);
          if (savedLook?.items.length) {
            setCanvasPieces(savedLook.items);
            setSaved(true);
          }
          setWardrobeError("");
        })
        .catch((error: unknown) => {
          if (active) setWardrobeError(error instanceof Error ? error.message : "No se pudo abrir tu armario.");
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
        const body = new FormData();
        body.append("file", item.file);
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

    let timedOut = false;
    for (let attempt = 0; attempt < 90 && remote.size > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
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
        setGarments((items) => mergeApiGarments(items, [statusResult.garment as ApiGarment]));
        if (statusResult.garment.status === "ready") {
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

  function shuffleLook() {
    const bottoms = garments.filter((item) => item.category === "Bottoms");
    const tops = garments.filter((item) => item.category === "Tops");
    const outerLayers = garments.filter((item) => item.category === "Outerwear" || item.category === "Tailoring");
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const top = tops[Math.floor(Math.random() * tops.length)];
    const outer = outerLayers[Math.floor(Math.random() * outerLayers.length)];
    const bottomPlacement = defaultPlacement(bottom);
    const topPlacement = defaultPlacement(top);
    const outerPlacement = defaultPlacement(outer);
    const next: CanvasPiece[] = [
      { instanceId: crypto.randomUUID(), garmentId: bottom.id, variant: "closed", ...bottomPlacement, rotation: 0, z: layerBase(bottom.category) + 1 },
      { instanceId: crypto.randomUUID(), garmentId: top.id, variant: "closed", ...topPlacement, rotation: 0, z: layerBase(top.category) + 1 },
      { instanceId: crypto.randomUUID(), garmentId: outer.id, variant: outer.openImage ? "open" : "closed", ...outerPlacement, rotation: 0, z: layerBase(outer.category) + 1 },
    ];
    setCanvasPieces(next);
    setSelectedId(next[2].instanceId);
    setSaved(false);
  }

  async function saveCurrentOutfit() {
    if (canvasPieces.length === 0) return;
    if (isStaticDemo) {
      setSaved(true);
      return;
    }
    setSavingOutfit(true);
    setWardrobeError("");
    try {
      const response = await fetch(`/api/outfits/${currentOutfitId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Conjunto actual", items: canvasPieces }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null) as { error?: string } | null)?.error || "No se pudo guardar el conjunto.");
      setSaved(true);
    } catch (error) {
      setWardrobeError(error instanceof Error ? error.message : "No se pudo guardar el conjunto.");
    } finally {
      setSavingOutfit(false);
    }
  }

  async function retryProcessing(item: Garment) {
    setGarmentSaveError("");
    setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "queued" } : garment));
    try {
      const response = await fetch(`/api/garments/${encodeURIComponent(item.id)}/retry`, { method: "POST" });
      const result = await response.json().catch(() => null) as { job?: { status?: string }; error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "No se pudo reiniciar el procesamiento.");
      if (result?.job?.status === "waiting_for_key") throw new Error("Falta conectar la clave de procesamiento.");
      setGarmentDraft(null);
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`/api/garments/${encodeURIComponent(item.id)}/status`, { cache: "no-store" });
        const statusResult = await statusResponse.json().catch(() => null) as { garment?: ApiGarment; job?: { error?: string; status?: string } } | null;
        if (!statusResponse.ok || !statusResult?.garment) throw new Error("No se pudo revisar el recorte.");
        setGarments((items) => mergeApiGarments(items, [statusResult.garment as ApiGarment]));
        if (statusResult.garment.status === "ready") return;
        if (statusResult.garment.status === "failed") throw new Error(statusResult.job?.error || "El recorte volvió a fallar.");
      }
    } catch (error) {
      setGarments((items) => items.map((garment) => garment.id === item.id ? { ...garment, status: "failed" } : garment));
      setWardrobeError(error instanceof Error ? error.message : "No se pudo reiniciar el procesamiento.");
    }
  }

  return (
    <main className={`site-shell view-${view}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => openWardrobe()} aria-label="Ir al armario">FORME<span>®</span></button>
        <nav className="zone-nav" aria-label="Secciones principales">
          <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}>Armario</button>
          <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}>Canvas</button>
        </nav>
        <button className="avatar" onClick={() => openWardrobe()} aria-label="Abrir mi perfil"><img className={profileImageClass} src={profileImage} alt="" /></button>
      </header>

      {view === "wardrobe" && (
        <section className="content wardrobe-view">
          <section className="wardrobe-profile">
            <div className="profile-identity">
              <span className="profile-avatar"><img className={profileImageClass} src={profileImage} alt={`Foto de perfil de ${profile.name}`} /></span>
              <div><p>MI ARMARIO</p><h1>{profile.name}</h1><span>{profile.handle}</span></div>
            </div>
            <div className="profile-stats">
              <p><strong>{garments.length}</strong><span>Prendas</span></p>
              <p><strong>{favoriteCount}</strong><span>Favoritas</span></p>
            </div>
            <nav className="wardrobe-tabs" aria-label="Mi armario">
              <button className={wardrobePanel === "pieces" ? "active" : ""} onClick={() => setWardrobePanel("pieces")}>Mis prendas</button>
              <button className={wardrobePanel === "upload" ? "active" : ""} onClick={() => setWardrobePanel("upload")}>＋ Añadir prenda</button>
            </nav>
          </section>
          {wardrobeError && <div className="app-message error" role="status">{wardrobeError}<button onClick={() => setWardrobeError("")} aria-label="Cerrar mensaje">×</button></div>}

          {wardrobePanel === "pieces" ? (
            <section className="pieces-section">
              <div className="catalog-toolbar">
                <div><p>COLECCIÓN</p><h2>Mis prendas</h2></div>
                <div><span>{visible.length} de {garments.length}</span><button className={filtersOpen || archiveFilterCount > 0 ? "active" : ""} onClick={() => setFiltersOpen((open) => !open)}>Filtros{archiveFilterCount > 0 ? ` · ${archiveFilterCount}` : ""}</button></div>
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
                          {(item.status === "queued" || item.status === "processing" || item.status === "uploaded") && <span className="processing-badge">PREPARANDO RECORTE</span>}
                          {item.status === "failed" && <span className="processing-badge failed">REVISAR RECORTE</span>}
                          <button className="card-detail-open" onClick={() => openGarmentEditor(item)} aria-label={`Abrir ficha de ${translateGarmentName(item.name)}`}><span>VER FICHA ↗</span></button>
                          <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => toggleFavorite(item)} aria-label={`${item.favorite ? "Quitar de" : "Añadir a"} favoritas: ${translateGarmentName(item.name)}`}>♥</button>
                          <button className="card-studio-add" onClick={() => addAndOpenStudio(item.id)}>AÑADIR AL CANVAS <span>＋</span></button>
                        </div>
                        <button className="card-meta" onClick={() => openGarmentEditor(item)} aria-label={`Editar ${translateGarmentName(item.name)}`}><span><strong>{translateGarmentName(item.name)}</strong><small>{item.brand ? `${item.brand} · ` : ""}{translateValue(item.category)} · {translateValue(item.tone)}</small></span><b>↗</b></button>
                      </article>
                    ))}
                    {visible.length === 0 && <div className="filter-empty">NO HAY PRENDAS<button onClick={() => setArchiveFilters(emptyFilters)}>LIMPIAR FILTROS</button></div>}
                  </div>
                </div>
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
                          <label>TIPO<select disabled={!editable} value={item.category} onChange={(event) => updateUploadItem(item.id, { category: event.target.value as Garment["category"] })}><option value="Outerwear">Abrigos</option><option value="Tops">Prendas superiores</option><option value="Bottoms">Pantalones</option><option value="Tailoring">Sastrería</option></select></label>
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
          <div className="section-line"><h2>CANVAS</h2><p>{canvasPieces.length} PRENDAS</p></div>
          <div className="studio-layout">
            <div className="canvas-column">
              <div className="look-canvas" ref={canvasRef}>
                <p className="look-date">CONJUNTO 001 / ARRASTRA · PELLIZCA · GIRA</p>
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
              </div>
            </div>

            <button className={`floating-panel-toggle library-panel-toggle ${libraryOpen ? "active" : ""}`} onClick={() => setLibraryOpen((open) => !open)} aria-expanded={libraryOpen} aria-label="Abrir armario">
              <span>ARMARIO</span><b>{libraryOpen ? "×" : "＋"}</b>
            </button>

            <div className={`look-controls ${libraryOpen ? "panel-open" : "panel-closed"}`}>
              <div className="floating-panel-header"><span>ARMARIO / {String(garments.length).padStart(2, "0")}</span><button onClick={() => setLibraryOpen(false)} aria-label="Cerrar armario">×</button></div>
              <div className="selected-readout">
                <p>PRENDA SELECCIONADA</p>
                <h3>{selectedGarment ? translateGarmentName(selectedGarment.name) : "Toca una prenda"}</h3>
                <small>{selectedGarment ? translateValue(selectedGarment.category) : "Selecciona una prenda del canvas"}</small>
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

              <div className="tray-heading"><h3>PRENDAS</h3><p>TOCA PARA AÑADIR</p></div>
              <div className="sticker-tray">
                {garments.map((item) => (
                  <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Añadir ${translateGarmentName(item.name)} al canvas`}>
                    <img src={imageSrc(item.image)} alt="" loading="lazy" />
                    <span>{translateGarmentName(item.name)}</span>
                  </button>
                ))}
              </div>

              <div className="studio-actions">
                <button className="shuffle" onClick={shuffleLook}>CONJUNTO ALEATORIO <span>↻</span></button>
                <button className="clear-look" onClick={() => { setCanvasPieces([]); setSelectedId(""); setSaved(false); }}>VACIAR</button>
              </div>
              {wardrobeError && <div className="panel-error" role="status">{wardrobeError}</div>}
              <button className={`primary-action ${saved ? "ready" : ""}`} disabled={canvasPieces.length === 0 || savingOutfit} onClick={saveCurrentOutfit}>{saved ? "CONJUNTO GUARDADO" : savingOutfit ? "GUARDANDO…" : "GUARDAR CONJUNTO"}<span>{saved ? "✓" : "＋"}</span></button>
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
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}><span>▦</span>Armario</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><span>◫</span>Canvas</button>
      </nav>
    </main>
  );
}
