"use client";

import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";

type View = "wardrobe" | "upload" | "studio";
type Garment = {
  id: string;
  name: string;
  category: string;
  color: string;
  image: string;
  status: "ghosted" | "original";
  favorite?: boolean;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;

const starterGarments: Garment[] = [
  { id: "g1", name: "Asymmetric Puffer", category: "Outerwear", color: "Black", image: asset("/wardrobe/asymmetric-puffer.png"), status: "ghosted", favorite: true },
  { id: "g2", name: "Graphic Blazer", category: "Tailoring", color: "Black", image: asset("/wardrobe/graphic-blazer.png"), status: "ghosted" },
  { id: "g3", name: "Technical Trench", category: "Outerwear", color: "Black", image: asset("/wardrobe/technical-trench.png"), status: "ghosted" },
  { id: "g4", name: "Essentials Crew", category: "Tops", color: "Black", image: asset("/wardrobe/essentials-sweatshirt.png"), status: "ghosted", favorite: true },
  { id: "g5", name: "Hooded Field Parka", category: "Outerwear", color: "Black", image: asset("/wardrobe/hooded-parka.png"), status: "ghosted" },
  { id: "g6", name: "Greige Shell", category: "Outerwear", color: "Greige", image: asset("/wardrobe/greige-shell.png"), status: "ghosted" },
  { id: "g7", name: "Human Made Jacket", category: "Outerwear", color: "Cream", image: asset("/wardrobe/human-made-jacket.png"), status: "ghosted" },
  { id: "g8", name: "Cropped Blazer", category: "Tailoring", color: "Black", image: asset("/wardrobe/cropped-blazer.png"), status: "ghosted" },
];

const viewCopy: Record<View, { eyebrow: string; title: string; note: string }> = {
  wardrobe: { eyebrow: "Private archive / 08 pieces", title: "Your clothes,\nfinally visible.", note: "A clean visual index of everything you own—ready to wear, combine and remember." },
  upload: { eyebrow: "Ghost studio / New intake", title: "From camera roll\nto clean cut.", note: "Upload one clear photo. We remove the hanger, rebuild the shape and keep every important detail." },
  studio: { eyebrow: "Look study / Live composition", title: "Build the look\nbefore the day.", note: "Stack pieces, test proportions and save the combinations worth repeating." },
};

export default function Home() {
  const [view, setView] = useState<View>("wardrobe");
  const [garments, setGarments] = useState(starterGarments);
  const [filter, setFilter] = useState("All");
  const [preview, setPreview] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Outerwear");
  const [stage, setStage] = useState<"idle" | "uploading" | "ghosting" | "ready">("idle");
  const [look, setLook] = useState(["g1", "g4", "g8"]);
  const [saved, setSaved] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ["All", ...Array.from(new Set(garments.map((item) => item.category)))], [garments]);
  const visible = filter === "All" ? garments : garments.filter((item) => item.category === filter);
  const lookPieces = look.map((id) => garments.find((item) => item.id === id) ?? garments[0]);

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

  function cyclePiece(slot: number, direction: number) {
    const current = garments.findIndex((item) => item.id === look[slot]);
    const next = (current + direction + garments.length) % garments.length;
    setLook((items) => items.map((item, index) => (index === slot ? garments[next].id : item)));
    setSaved(false);
  }

  function shuffleLook() {
    const shuffled = [...garments].sort(() => Math.random() - 0.5).slice(0, 3).map((item) => item.id);
    setLook(shuffled);
    setSaved(false);
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <button className="wordmark" onClick={() => setView("wardrobe")} aria-label="Go to wardrobe">FORME<span>®</span></button>
        <p className="issue">WARDROBE SYSTEM<br />ISSUE NO. 01</p>
        <button className="avatar" aria-label="Open profile">TA</button>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">{viewCopy[view].eyebrow}</p>
          <h1>{viewCopy[view].title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
        </div>
        <p className="hero-note">{viewCopy[view].note}</p>
      </section>

      <nav className="desktop-nav" aria-label="Main navigation">
        {(["wardrobe", "upload", "studio"] as View[]).map((item, index) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            <span>0{index + 1}</span>{item === "wardrobe" ? "Wardrobe" : item === "upload" ? "Ghost a piece" : "Outfit studio"}
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
                  <img src={item.image} alt={item.name} />
                  <span className="item-number">{String(index + 1).padStart(2, "0")}</span>
                  <button className={`heart ${item.favorite ? "active" : ""}`} onClick={() => setGarments((items) => items.map((g) => g.id === item.id ? { ...g, favorite: !g.favorite } : g))} aria-label={`Favorite ${item.name}`}>♥</button>
                </div>
                <div className="card-meta"><div><h3>{item.name}</h3><p>{item.category} · {item.color}</p></div><span className="ghost-badge">GHOSTED</span></div>
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
              <label>PIECE NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Black technical jacket" /></label>
              <label>CATEGORY<select value={category} onChange={(e) => setCategory(e.target.value)}><option>Outerwear</option><option>Tops</option><option>Bottoms</option><option>Footwear</option><option>Accessories</option><option>Tailoring</option></select></label>
              <div className="process-list">
                <div className={stage !== "idle" ? "done" : "active"}><span>01</span><p><b>Original received</b><small>We inspect shape, material and details.</small></p></div>
                <div className={stage === "ghosting" || stage === "ready" ? "done" : ""}><span>02</span><p><b>Ghost mannequin</b><small>Hanger and background are removed.</small></p></div>
                <div className={stage === "ready" ? "done" : ""}><span>03</span><p><b>Ready to style</b><small>Your clean piece joins the wardrobe.</small></p></div>
              </div>
              {stage === "ready" ? <button className="primary-action ready" onClick={() => setView("wardrobe")}>VIEW IN WARDROBE <span>→</span></button> : <button className="primary-action" disabled={!file || stage === "uploading" || stage === "ghosting"} onClick={ghostGarment}>{stage === "uploading" ? "UPLOADING…" : stage === "ghosting" ? "GHOSTING YOUR PIECE…" : "GHOST THIS PIECE"}<span>→</span></button>}
              <p className="privacy-note">Your originals remain private. We preserve logos, stitching, hardware and the real silhouette.</p>
            </div>
          </div>
        </section>
      )}

      {view === "studio" && (
        <section className="content studio-view">
          <div className="section-line"><h2>LOOK 001</h2><p>3 LAYERS</p></div>
          <div className="studio-layout">
            <div className="look-canvas">
              <p className="look-date">MONDAY / LIMA / 18°</p>
              <div className="look-stack">
                {lookPieces.map((item, index) => <img key={`${item.id}-${index}`} src={item.image} alt={item.name} style={{ zIndex: 3 - index, transform: `translate(${(index - 1) * 12}px, ${index * 116}px) scale(${1 - index * .08})` }} />)}
              </div>
              <span className="look-caption">A STUDY IN<br />PROPORTION</span>
            </div>
            <div className="look-controls">
              {lookPieces.map((item, index) => (
                <div className="look-row" key={`${item.id}-control`}>
                  <span>0{index + 1}</span><img src={item.image} alt="" /><div><p>LAYER {index + 1}</p><h3>{item.name}</h3><small>{item.category}</small></div>
                  <div className="row-arrows"><button onClick={() => cyclePiece(index, -1)} aria-label="Previous piece">←</button><button onClick={() => cyclePiece(index, 1)} aria-label="Next piece">→</button></div>
                </div>
              ))}
              <button className="shuffle" onClick={shuffleLook}>SHUFFLE THE ARCHIVE <span>↻</span></button>
              <button className={`primary-action ${saved ? "ready" : ""}`} onClick={() => setSaved(true)}>{saved ? "LOOK SAVED" : "SAVE THIS LOOK"}<span>{saved ? "✓" : "＋"}</span></button>
            </div>
          </div>
        </section>
      )}

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <button className={view === "wardrobe" ? "active" : ""} onClick={() => setView("wardrobe")}><span>▦</span>Wardrobe</button>
        <button className={view === "upload" ? "active" : ""} onClick={() => setView("upload")}><span>＋</span>Add</button>
        <button className={view === "studio" ? "active" : ""} onClick={() => setView("studio")}><span>◫</span>Studio</button>
      </nav>
    </main>
  );
}
