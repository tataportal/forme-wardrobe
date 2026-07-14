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

type View = "wardrobe" | "upload" | "studio";
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
  { key: "category", label: "Layer" },
  { key: "colorFamily", label: "Color" },
  { key: "tone", label: "Tone" },
  { key: "material", label: "Material" },
  { key: "finish", label: "Finish" },
  { key: "silhouette", label: "Fit" },
];

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
    <div className={`attribute-filters ${compact ? "compact" : ""}`} aria-label="Filter garments by attributes">
      {filterLabels.map(({ key, label }) => {
        const values = key === "tone" && value.colorFamily !== "All" ? options.tonesByColor[value.colorFamily] ?? [] : options[key];
        return (
          <label key={key}>{label}
            <select value={value[key]} onChange={(event) => onChange(key, event.target.value)}>
              <option value="All">All</option>
              {values.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        );
      })}
      <button type="button" className="reset-filters" disabled={activeCount === 0} onClick={onReset}>RESET {activeCount > 0 ? `(${activeCount})` : ""}</button>
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
const defaultPlacement = (category: Garment["category"]) => {
  if (category === "Bottoms") return { x: 50, y: 66.5, scale: 0.8 };
  if (category === "Tops") return { x: 50, y: 32, scale: 0.53 };
  if (category === "Tailoring") return { x: 50, y: 33, scale: 0.62 };
  return { x: 50, y: 32.5, scale: 0.64 };
};

const viewCopy: Record<View, { title: string; note: string }> = {
  wardrobe: { title: "Your clothes,\nfinally visible.", note: "A playful visual index of everything you own—cut out, ready to combine and impossible to forget." },
  upload: { title: "From camera roll\nto clean cut.", note: "Upload one clear photo. We rebuild the shape, preserve the details and turn it into a movable wardrobe cutout." },
  studio: { title: "Move it until\nit feels right.", note: "Drag with one finger. Pinch and twist to resize and rotate. Hold supported outerwear to open or close it; tap again to remove." },
};

const initialCanvas: CanvasPiece[] = [
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", variant: "closed", x: 50, y: 66.5, scale: 0.8, rotation: 0, z: 1001 },
  { instanceId: "initial-tee", garmentId: "top-basic-white-tee", variant: "closed", x: 50, y: 32, scale: 0.53, rotation: 0, z: 2001 },
  { instanceId: "initial-jacket", garmentId: "archive-002", variant: "open", x: 50, y: 32.5, scale: 0.64, rotation: 0, z: 3001 },
];

export default function Home() {
  const [view, setView] = useState<View>("wardrobe");
  const [garments, setGarments] = useState(starterGarments);
  const [archiveFilters, setArchiveFilters] = useState<WardrobeFilters>(emptyFilters);
  const [studioFilters, setStudioFilters] = useState<WardrobeFilters>(emptyFilters);
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
  const trayGarments = garments.filter((item) => matchFilters(item, studioFilters));
  const selectedPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;

  const eyebrow = view === "wardrobe"
    ? `Private archive / ${String(garments.length).padStart(2, "0")} pieces`
    : view === "upload"
      ? "Ghost studio / New intake"
      : `Look study / ${String(canvasPieces.length).padStart(2, "0")} movable cutouts`;

  function updateArchiveFilter(key: FilterKey, next: string) {
    setArchiveFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
  }

  function updateStudioFilter(key: FilterKey, next: string) {
    setStudioFilters((current) => ({ ...current, [key]: next, ...(key === "colorFamily" ? { tone: "All" } : {}) }));
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
    const custom = { name: name || "Untitled piece", category, color: "Custom" };
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
    const placement = defaultPlacement(garment.category);
    setCanvasPieces((items) => {
      const base = layerBase(garment.category);
      const top = Math.max(base, ...items.filter((item) => {
        const itemGarment = garmentById.get(item.garmentId);
        return itemGarment && layerBase(itemGarment.category) === base;
      }).map((item) => item.z)) + 1;
      const hasInnerTop = items.some((item) => garmentById.get(item.garmentId)?.category === "Tops");
      return [...items, {
        instanceId,
        garmentId,
        variant: garment.openImage && hasInnerTop ? "open" : "closed",
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
    const bottomPlacement = defaultPlacement(bottom.category);
    const topPlacement = defaultPlacement(top.category);
    const outerPlacement = defaultPlacement(outer.category);
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
        <button className="wordmark" onClick={() => setView("wardrobe")} aria-label="Go to wardrobe">FORME<span>®</span></button>
        <p className="issue">WARDROBE SYSTEM<br />ISSUE NO. 02</p>
        <button className="avatar" aria-label="Open profile">TA</button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{viewCopy[view].title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
        </div>
        <p className="hero-note">{viewCopy[view].note}</p>
      </section>

      <nav className="desktop-nav" aria-label="Main navigation">
        {(["wardrobe", "upload", "studio"] as View[]).map((item, index) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            <span>0{index + 1}</span>{item === "wardrobe" ? "Wardrobe" : item === "upload" ? "Ghost a piece" : "Cutout studio"}
          </button>
        ))}
      </nav>

      {view === "wardrobe" && (
        <section className="content wardrobe-view">
          <div className="section-line">
            <h2>THE ARCHIVE</h2><p>{String(visible.length).padStart(2, "0")} ITEMS</p>
          </div>
          <AttributeFilters value={archiveFilters} options={filterOptions} onChange={updateArchiveFilter} onReset={() => setArchiveFilters(emptyFilters)} />
          <div className="garment-grid">
            {visible.map((item, index) => (
              <article className="garment-card" key={item.id}>
                <div className="image-wrap">
                  <img src={imageSrc(item.image)} alt={item.name} loading="lazy" />
                  <span className="item-number">{String(index + 1).padStart(2, "0")}</span>
                  <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => setGarments((items) => items.map((g) => g.id === item.id ? { ...g, favorite: !g.favorite } : g))} aria-label={`Favorite ${item.name}`}>♥</button>
                  <button className="card-studio-add" onClick={() => addAndOpenStudio(item.id)}>ADD TO CANVAS <span>＋</span></button>
                </div>
                <div className="card-meta"><div><h3>{item.name}</h3><p>{item.category} · {item.tone}</p><p>{item.material} · {item.finish}</p></div><span className="ghost-badge">{item.silhouette}</span></div>
              </article>
            ))}
            {visible.length === 0 && <div className="filter-empty">NO PIECES MATCH<br /><button onClick={() => setArchiveFilters(emptyFilters)}>RESET FILTERS</button></div>}
          </div>
          <button className="wide-action" onClick={() => setView("upload")}><span>ADD TO THE ARCHIVE</span><b>＋</b></button>
        </section>
      )}

      {view === "upload" && (
        <section className="content upload-view">
          <div className="section-line"><h2>NEW GARMENT</h2><p>JPG · PNG · HEIC</p></div>
          <div className="upload-layout">
            <div className={`dropzone ${preview ? "has-preview" : ""}`} onClick={() => fileInput.current?.click()} onDragOver={(event: DragEvent) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); acceptFile(event.dataTransfer.files[0]); }}>
              <input ref={fileInput} type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => acceptFile(event.target.files?.[0])} hidden />
              {preview ? <img src={preview} alt="Selected garment preview" /> : <><span className="upload-mark">＋</span><h3>DROP YOUR GARMENT</h3><p>Front-facing works best.<br />Hangers and messy backgrounds are okay.</p><button type="button">CHOOSE A PHOTO</button></>}
              {preview && <button className="replace-photo" type="button">REPLACE PHOTO</button>}
            </div>
            <div className="intake-panel">
              <label>PIECE NAME<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Black technical jacket" /></label>
              <label>CATEGORY<select value={category} onChange={(event) => setCategory(event.target.value as Garment["category"])}><option>Outerwear</option><option>Tops</option><option>Bottoms</option><option>Tailoring</option></select></label>
              <div className="process-list">
                <div className={stage !== "idle" ? "done" : "active"}><span>01</span><p><b>Original received</b><small>We inspect shape, material and details.</small></p></div>
                <div className={stage === "ghosting" || stage === "ready" ? "done" : ""}><span>02</span><p><b>Ghost mannequin</b><small>Hanger and background are removed.</small></p></div>
                <div className={stage === "ready" ? "done" : ""}><span>03</span><p><b>Cutout ready</b><small>A clean border makes it movable.</small></p></div>
              </div>
              {stage === "ready" ? <button className="primary-action ready" onClick={() => setView("wardrobe")}>VIEW IN WARDROBE <span>→</span></button> : <button className="primary-action" disabled={!file || stage === "uploading" || stage === "ghosting"} onClick={ghostGarment}>{stage === "uploading" ? "UPLOADING…" : stage === "ghosting" ? "CUTTING OUT YOUR PIECE…" : "MAKE THIS CUTOUT"}<span>→</span></button>}
              <p className="privacy-note">Your originals remain private. We preserve logos, stitching, hardware and the real silhouette.</p>
            </div>
          </div>
        </section>
      )}

      {view === "studio" && (
        <section className="content studio-view">
          <div className="section-line"><h2>LOOK 001</h2><p>{canvasPieces.length} MOVABLE LAYERS</p></div>
          <div className="studio-layout">
            <div className="canvas-column">
              <div className="look-canvas" ref={canvasRef}>
                <p className="look-date">LOOK 001 / DRAG · PINCH · TWIST</p>
                <span className="canvas-hint">HOLD = OPEN / CLOSED</span>
                {canvasPieces.length === 0 && <button className="empty-canvas" onClick={() => addToCanvas(garments[0].id)}>YOUR CANVAS IS EMPTY<br /><span>ADD A CUTOUT ＋</span></button>}
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
                      <img src={imageSrc(canvasImage)} alt={garment.name} draggable={false} />
                    </div>
                  );
                })}
                <span className="look-caption">DRESS<br />BY FEEL</span>
              </div>
            </div>

            <button className={`floating-panel-toggle library-panel-toggle ${libraryOpen ? "active" : ""}`} onClick={() => setLibraryOpen((open) => !open)} aria-expanded={libraryOpen}>
              <span>WARDROBE</span><b>{libraryOpen ? "×" : "＋"}</b>
            </button>

            <div className={`look-controls ${libraryOpen ? "panel-open" : "panel-closed"}`}>
              <div className="floating-panel-header"><span>WARDROBE / {String(trayGarments.length).padStart(2, "0")}</span><button onClick={() => setLibraryOpen(false)} aria-label="Hide pieces panel">×</button></div>
              <div className="selected-readout">
                <p>SELECTED CUTOUT</p>
                <h3>{selectedGarment?.name ?? "Tap a piece"}</h3>
                <small>{selectedGarment ? `${selectedGarment.tone} · ${selectedGarment.material} · ${selectedGarment.finish}` : "Choose something on the canvas"}</small>
                {selectedPiece && <button onClick={() => sendSelected("back")}>SEND TO BACK ↓</button>}
              </div>
              <div className="canvas-tools" aria-label="Selected cutout controls">
                <button disabled={!selectedPiece} onClick={() => scaleSelected(-0.06)} aria-label="Make selected piece smaller"><span>−</span><em>SIZE</em></button>
                <button disabled={!selectedPiece} onClick={() => scaleSelected(0.06)} aria-label="Make selected piece larger"><span>＋</span><em>SIZE</em></button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(-8)} aria-label="Rotate selected piece left"><span>↺</span><em>TURN</em></button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(8)} aria-label="Rotate selected piece right"><span>↻</span><em>TURN</em></button>
                <button disabled={!selectedPiece} onClick={() => sendSelected("front")} aria-label="Bring selected piece to front"><span>↑</span><em>FRONT</em></button>
                <button disabled={!selectedPiece} onClick={removeSelected} className="remove-tool" aria-label="Remove selected piece"><span>×</span><em>REMOVE</em></button>
              </div>

              <div className="tray-heading"><h3>STICKER TRAY</h3><p>TAP TO ADD</p></div>
              <AttributeFilters compact value={studioFilters} options={filterOptions} onChange={updateStudioFilter} onReset={() => setStudioFilters(emptyFilters)} />
              <div className="sticker-tray">
                {trayGarments.map((item) => (
                  <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Add ${item.name} to canvas`}>
                    <img src={imageSrc(item.image)} alt="" loading="lazy" />
                    <span>{item.name}</span>
                  </button>
                ))}
                {trayGarments.length === 0 && <div className="filter-empty compact-empty">NO MATCHES<button onClick={() => setStudioFilters(emptyFilters)}>RESET</button></div>}
              </div>

              <div className="studio-actions">
                <button className="shuffle" onClick={shuffleLook}>MAKE A RANDOM LOOK <span>↻</span></button>
                <button className="clear-look" onClick={() => { setCanvasPieces([]); setSelectedId(""); setSaved(false); }}>CLEAR CANVAS</button>
              </div>
              <button className={`primary-action ${saved ? "ready" : ""}`} disabled={canvasPieces.length === 0} onClick={() => setSaved(true)}>{saved ? "LOOK SAVED" : "SAVE THIS LOOK"}<span>{saved ? "✓" : "＋"}</span></button>
            </div>
          </div>
        </section>
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => setView("wardrobe")}><span>▦</span>Wardrobe</button>
        <button className={view === "upload" ? "active" : ""} onClick={() => setView("upload")}><span>＋</span>Add</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><span>◫</span>Canvas</button>
      </nav>
    </main>
  );
}
