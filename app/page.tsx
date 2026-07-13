"use client";

import {
  ChangeEvent,
  DragEvent,
  PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { Garment, starterGarments } from "./garments";

type View = "wardrobe" | "upload" | "studio";
type CanvasPiece = {
  instanceId: string;
  garmentId: string;
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
};

type PinchSession = {
  instanceId: string;
  pointerIds: [number, number];
  startDistance: number;
  startScale: number;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;
const imageSrc = (path: string) => (path.startsWith("/") ? asset(path) : path);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const viewCopy: Record<View, { title: string; note: string }> = {
  wardrobe: { title: "Your clothes,\nfinally visible.", note: "A playful visual index of everything you own—cut out, ready to combine and impossible to forget." },
  upload: { title: "From camera roll\nto clean cut.", note: "Upload one clear photo. We rebuild the shape, preserve the details and turn it into a movable wardrobe cutout." },
  studio: { title: "Move it until\nit feels right.", note: "Tap to select, pinch to resize and drag anywhere. Tap the same piece again to remove it." },
};

const initialCanvas: CanvasPiece[] = [
  { instanceId: "initial-bottom", garmentId: "bottom-blue-jeans", x: 50, y: 66, scale: 0.84, rotation: 0, z: 1 },
  { instanceId: "initial-jacket", garmentId: "archive-032", x: 50, y: 35, scale: 0.76, rotation: 0, z: 2 },
];

export default function Home() {
  const [view, setView] = useState<View>("wardrobe");
  const [garments, setGarments] = useState(starterGarments);
  const [filter, setFilter] = useState("All");
  const [studioFilter, setStudioFilter] = useState("All");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Garment["category"]>("Outerwear");
  const [stage, setStage] = useState<"idle" | "uploading" | "ghosting" | "ready">("idle");
  const [canvasPieces, setCanvasPieces] = useState(initialCanvas);
  const [selectedId, setSelectedId] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragSession = useRef<DragSession | null>(null);
  const pointerTracks = useRef(new Map<number, PointerTrack>());
  const pinchSession = useRef<PinchSession | null>(null);

  const garmentById = useMemo(() => new Map(garments.map((item) => [item.id, item])), [garments]);
  const categories = useMemo(() => ["All", ...Array.from(new Set(garments.map((item) => item.category)))], [garments]);
  const visible = filter === "All" ? garments : garments.filter((item) => item.category === filter);
  const trayGarments = studioFilter === "All" ? garments : garments.filter((item) => item.category === studioFilter);
  const selectedPiece = canvasPieces.find((item) => item.instanceId === selectedId);
  const selectedGarment = selectedPiece ? garmentById.get(selectedPiece.garmentId) : undefined;

  const eyebrow = view === "wardrobe"
    ? `Private archive / ${String(garments.length).padStart(2, "0")} pieces`
    : view === "upload"
      ? "Ghost studio / New intake"
      : `Look study / ${String(canvasPieces.length).padStart(2, "0")} movable cutouts`;

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
    setGarments((items) => [{ id, name: name || "Untitled piece", category, color: "Custom", image, status: "ghosted" }, ...items]);
    setStage("ready");
  }

  function bringToFront(instanceId: string) {
    setCanvasPieces((items) => {
      const top = Math.max(0, ...items.map((item) => item.z)) + 1;
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
    const top = Math.max(0, ...canvasPieces.map((item) => item.z)) + 1;
    const isBottom = garment.category === "Bottoms";
    const offset = (canvasPieces.length % 5) * 2;
    setCanvasPieces((items) => [...items, {
      instanceId,
      garmentId,
      x: clamp(50 + offset - 4, 12, 88),
      y: isBottom ? 66 : 36 + offset,
      scale: isBottom ? 0.84 : 0.72,
      rotation: (canvasPieces.length % 3 - 1) * 3,
      z: top,
    }]);
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
      setCanvasPieces((items) => items.map((item) => item.instanceId === pinch.instanceId ? { ...item, scale } : item));
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

    if (!cancelled && !wasPinching && track && !track.moved && track.wasSelected) {
      removePiece(track.instanceId);
    }
  }

  function updateSelected(patch: Partial<CanvasPiece>) {
    if (!selectedId) return;
    setCanvasPieces((items) => items.map((item) => item.instanceId === selectedId ? { ...item, ...patch } : item));
    setSaved(false);
  }

  function scaleSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ scale: clamp(selectedPiece.scale + delta, 0.28, 1.35) });
  }

  function rotateSelected(delta: number) {
    if (!selectedPiece) return;
    updateSelected({ rotation: selectedPiece.rotation + delta });
  }

  function sendSelected(direction: "front" | "back") {
    if (!selectedPiece) return;
    const levels = canvasPieces.map((item) => item.z);
    updateSelected({ z: direction === "front" ? Math.max(...levels) + 1 : Math.min(...levels) - 1 });
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
    const tops = garments.filter((item) => item.category !== "Bottoms");
    const bottom = bottoms[Math.floor(Math.random() * bottoms.length)];
    const top = tops[Math.floor(Math.random() * tops.length)];
    const next: CanvasPiece[] = [
      { instanceId: crypto.randomUUID(), garmentId: bottom.id, x: 50, y: 66, scale: 0.84, rotation: 0, z: 1 },
      { instanceId: crypto.randomUUID(), garmentId: top.id, x: 50, y: 35, scale: 0.74, rotation: 0, z: 2 },
    ];
    setCanvasPieces(next);
    setSelectedId(next[1].instanceId);
    setSaved(false);
  }

  return (
    <main className="site-shell">
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
          <div className="filters" aria-label="Filter garments">
            {categories.map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
          </div>
          <div className="garment-grid">
            {visible.map((item, index) => (
              <article className="garment-card" key={item.id}>
                <div className="image-wrap">
                  <img src={imageSrc(item.image)} alt={item.name} loading="lazy" />
                  <span className="item-number">{String(index + 1).padStart(2, "0")}</span>
                  <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => setGarments((items) => items.map((g) => g.id === item.id ? { ...g, favorite: !g.favorite } : g))} aria-label={`Favorite ${item.name}`}>♥</button>
                  <button className="card-studio-add" onClick={() => addAndOpenStudio(item.id)}>ADD TO CANVAS <span>＋</span></button>
                </div>
                <div className="card-meta"><div><h3>{item.name}</h3><p>{item.category} · {item.color}</p></div><span className="ghost-badge">CUTOUT</span></div>
              </article>
            ))}
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
                <p className="look-date">DRAG / PINCH / ROTATE</p>
                <span className="canvas-hint">TAP AGAIN = REMOVE</span>
                {canvasPieces.length === 0 && <button className="empty-canvas" onClick={() => addToCanvas(garments[0].id)}>YOUR CANVAS IS EMPTY<br /><span>ADD A CUTOUT ＋</span></button>}
                {canvasPieces.map((piece) => {
                  const garment = garmentById.get(piece.garmentId);
                  if (!garment) return null;
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
                      <img src={imageSrc(garment.image)} alt={garment.name} draggable={false} />
                    </div>
                  );
                })}
                <span className="look-caption">DRESS<br />BY FEEL</span>
              </div>
              <div className="canvas-tools" aria-label="Selected cutout controls">
                <button disabled={!selectedPiece} onClick={() => scaleSelected(-0.08)}><span>−</span>SIZE</button>
                <button disabled={!selectedPiece} onClick={() => scaleSelected(0.08)}><span>＋</span>SIZE</button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(-8)}><span>↺</span>TURN</button>
                <button disabled={!selectedPiece} onClick={() => rotateSelected(8)}><span>↻</span>TURN</button>
                <button disabled={!selectedPiece} onClick={() => sendSelected("front")}><span>↑</span>FRONT</button>
                <button disabled={!selectedPiece} onClick={removeSelected} className="remove-tool"><span>×</span>REMOVE</button>
              </div>
            </div>

            <div className="look-controls">
              <div className="selected-readout">
                <p>SELECTED CUTOUT</p>
                <h3>{selectedGarment?.name ?? "Tap a piece"}</h3>
                <small>{selectedGarment ? `${selectedGarment.category} · ${selectedGarment.color}` : "Choose something on the canvas"}</small>
                {selectedPiece && <button onClick={() => sendSelected("back")}>SEND TO BACK ↓</button>}
              </div>

              <div className="tray-heading"><h3>STICKER TRAY</h3><p>TAP TO ADD</p></div>
              <div className="filters studio-filters" aria-label="Filter sticker tray">
                {categories.map((item) => <button key={item} className={studioFilter === item ? "active" : ""} onClick={() => setStudioFilter(item)}>{item}</button>)}
              </div>
              <div className="sticker-tray">
                {trayGarments.map((item) => (
                  <button key={item.id} onClick={() => addToCanvas(item.id)} aria-label={`Add ${item.name} to canvas`}>
                    <img src={imageSrc(item.image)} alt="" loading="lazy" />
                    <span>{item.name}</span>
                  </button>
                ))}
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
