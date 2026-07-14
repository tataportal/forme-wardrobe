"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
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

const emptyFilters: WardrobeFilters = {
  category: "All",
  colorFamily: "All",
  tone: "All",
  material: "All",
  finish: "All",
  silhouette: "All",
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
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Garment["category"]>("Outerwear");
  const [stage, setStage] = useState<"idle" | "uploading" | "ghosting" | "ready">("idle");
  const [canvasPieces, setCanvasPieces] = useState(initialCanvas);
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
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

  function updateArchiveFilter(key: FilterKey, next: string) {
    setArchiveFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
  }

  function openWardrobe(panel: WardrobePanel = "pieces") {
    setView("wardrobe");
    setWardrobePanel(panel);
    setLibraryOpen(false);
  }

  function resetUpload() {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview("");
    setFile(null);
    setName("");
    setCategory("Outerwear");
    setStage("idle");
  }

  function acceptFile(next: File | undefined) {
    if (!next || !next.type.startsWith("image/")) return;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(URL.createObjectURL(next));
    setName(next.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    setStage("idle");
  }

  async function ghostGarment() {
    if (!file || !preview) return;
    setStage("uploading");
    let image = preview;
    try {
      if (process.env.NEXT_PUBLIC_STATIC_DEMO === "1") throw new Error("Static demo");
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      if (response.ok) {
        const result = (await response.json()) as { url?: string };
        if (result.url) image = result.url;
      }
    } catch {
      // The local preview remains usable when hosted storage is unavailable.
    }
    await new Promise((resolve) => setTimeout(resolve, 650));
    setStage("ghosting");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const id = crypto.randomUUID();
    const custom = { name: name || "Prenda sin nombre", category, color: "Custom" };
    setGarments((items) => [{ id, ...custom, ...classifyGarment(custom), image, status: "ghosted" }, ...items]);
    setStage("ready");
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

  return (
    <main className={`site-shell view-${view}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => openWardrobe()} aria-label="Ir al armario">FORME<span>®</span></button>
        <nav className="zone-nav" aria-label="Secciones principales">
          <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}>Armario</button>
          <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}>Canvas</button>
        </nav>
        <button className="avatar" onClick={() => openWardrobe()} aria-label="Abrir mi perfil">TA</button>
      </header>

      {view === "wardrobe" && (
        <section className="content wardrobe-view">
          <section className="wardrobe-profile">
            <div className="profile-identity">
              <span className="profile-avatar">TA</span>
              <div><p>MI ARMARIO</p><h1>Tata</h1><span>@tataportal</span></div>
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

          {wardrobePanel === "pieces" ? (
            <section className="pieces-section">
              <div className="catalog-toolbar">
                <div><p>COLECCIÓN</p><h2>Mis prendas</h2></div>
                <div><span>{visible.length} de {garments.length}</span><button className={filtersOpen || archiveFilterCount > 0 ? "active" : ""} onClick={() => setFiltersOpen((open) => !open)}>Filtros{archiveFilterCount > 0 ? ` · ${archiveFilterCount}` : ""}</button></div>
              </div>
              <div className="wardrobe-catalog">
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
                          <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => setGarments((items) => items.map((g) => g.id === item.id ? { ...g, favorite: !g.favorite } : g))} aria-label={`${item.favorite ? "Quitar de" : "Añadir a"} favoritas: ${translateGarmentName(item.name)}`}>♥</button>
                          <button className="card-studio-add" onClick={() => addAndOpenStudio(item.id)}>AÑADIR AL CANVAS <span>＋</span></button>
                        </div>
                        <div className="card-meta"><div><h3>{translateGarmentName(item.name)}</h3><p>{translateValue(item.category)} · {translateValue(item.tone)}</p></div></div>
                      </article>
                    ))}
                    {visible.length === 0 && <div className="filter-empty">NO HAY PRENDAS<button onClick={() => setArchiveFilters(emptyFilters)}>LIMPIAR FILTROS</button></div>}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <section className="upload-view">
              <div className="upload-heading"><p>NUEVA PRENDA</p><h2>Añadir al armario</h2></div>
              <div className="upload-layout">
                <label className={`dropzone ${preview ? "has-preview" : ""}`} onDragOver={(event: DragEvent) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files[0]); }}>
                  <input ref={fileInput} type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])} hidden />
                  {preview ? <img src={preview} alt="Vista previa de la prenda" /> : <><span className="upload-mark">＋</span><h3>Selecciona una foto</h3></>}
                  {preview && <span className="replace-photo">CAMBIAR</span>}
                </label>
                <div className="intake-panel">
                  <label>NOMBRE<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Chaqueta negra" /></label>
                  <label>TIPO<select value={category} onChange={(event) => setCategory(event.target.value as Garment["category"])}><option value="Outerwear">Abrigos</option><option value="Tops">Prendas superiores</option><option value="Bottoms">Pantalones</option><option value="Tailoring">Sastrería</option></select></label>
                  {stage === "ready"
                    ? <button className="primary-action ready" onClick={() => { resetUpload(); setWardrobePanel("pieces"); }}>VER EN MI ARMARIO <span>→</span></button>
                    : <button className="primary-action" disabled={!file || stage === "uploading" || stage === "ghosting"} onClick={ghostGarment}>{stage === "uploading" ? "CARGANDO…" : stage === "ghosting" ? "PREPARANDO…" : "CREAR RECORTE"}<span>→</span></button>}
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
              <button className={`primary-action ${saved ? "ready" : ""}`} disabled={canvasPieces.length === 0} onClick={() => setSaved(true)}>{saved ? "CONJUNTO GUARDADO" : "GUARDAR CONJUNTO"}<span>{saved ? "✓" : "＋"}</span></button>
            </div>
          </div>
        </section>
      )}

      <nav className="mobile-nav" aria-label="Secciones principales">
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => openWardrobe()}><span>▦</span>Armario</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><span>◫</span>Canvas</button>
      </nav>
    </main>
  );
}
