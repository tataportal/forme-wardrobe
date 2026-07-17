"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PublicGarment = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  tone: string;
  material: string;
  image: string;
  openImage?: string;
};

type PublicLookItem = {
  instanceId: string;
  garmentId: string;
  variant: "closed" | "open";
  image: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  z: number;
};

type PublicLook = {
  id: string;
  name: string;
  items: PublicLookItem[];
};

type PublicProfilePayload = {
  profile: {
    name: string;
    handle: string;
    bio: string;
    avatarUrl?: string | null;
  };
  garments: PublicGarment[];
  outfits: PublicLook[];
};

function PublicLookPreview({ look }: { look: PublicLook }) {
  return <div className="public-look-preview" aria-label={`Vista previa de ${look.name}`}>
    {[...look.items].sort((a, b) => a.z - b.z).map((item) => <img
      key={item.instanceId}
      src={item.image}
      alt=""
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        zIndex: item.z,
        transform: `translate(-50%, -50%) rotate(${item.rotation}deg) scale(${item.scale})`,
      }}
    />)}
  </div>;
}

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const rawHandle = typeof params?.handle === "string" ? decodeURIComponent(params.handle) : "";
  const handle = rawHandle.replace(/^@/, "");
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const initials = useMemo(() => data?.profile.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase() || "F", [data]);

  useEffect(() => {
    if (!rawHandle.startsWith("@") || !handle) {
      setError("Este perfil no existe.");
      setLoading(false);
      return;
    }
    let active = true;
    void fetch(`/api/public-profile/${encodeURIComponent(handle)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as (PublicProfilePayload & { error?: string }) | null;
        if (!response.ok || !result?.profile) throw new Error(result?.error || "Este perfil es privado o no existe.");
        if (active) setData(result);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "No se pudo abrir este perfil."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [handle, rawHandle]);

  async function shareProfile() {
    if (!data) return;
    const payload = { title: `${data.profile.name} en Formé`, text: `Mira el closet de ${data.profile.name}`, url: window.location.href };
    if (navigator.share) await navigator.share(payload).catch(() => null);
    else await navigator.clipboard.writeText(window.location.href).catch(() => null);
  }

  if (loading) return <main className="public-profile-state"><a href="/">FORMÉ<span>®</span></a><p>ABRIENDO PERFIL…</p></main>;
  if (!data) return <main className="public-profile-state"><a href="/">FORMÉ<span>®</span></a><h1>No encontramos este perfil.</h1><p>{error}</p><a className="public-profile-home" href="/">VOLVER A FORMÉ →</a></main>;

  return <main className="public-profile-page">
    <header className="public-profile-nav"><a href="/">FORMÉ<span>®</span></a><button type="button" onClick={() => void shareProfile()}>COMPARTIR ↗</button></header>
    <section className="public-profile-hero">
      <div className="public-profile-avatar">{data.profile.avatarUrl ? <img src={data.profile.avatarUrl} alt={`Foto de ${data.profile.name}`} /> : <span>{initials}</span>}</div>
      <div className="public-profile-copy">
        <p>{data.profile.handle}</p>
        <h1>{data.profile.name}</h1>
        {data.profile.bio && <span>{data.profile.bio}</span>}
      </div>
      <div className="public-profile-counts">
        <p><strong>{data.garments.length}</strong><span>PRENDAS</span></p>
        <p><strong>{data.outfits.length}</strong><span>LOOKS</span></p>
      </div>
    </section>

    {data.outfits.length > 0 && <section className="public-profile-section">
      <header><p>LOOKS</p><span>{String(data.outfits.length).padStart(2, "0")}</span></header>
      <div className="public-looks-grid">{data.outfits.map((look) => <article key={look.id}><PublicLookPreview look={look} /><h2>{look.name}</h2><p>{look.items.length} PIEZAS</p></article>)}</div>
    </section>}

    {data.garments.length > 0 && <section className="public-profile-section">
      <header><p>SELECCIÓN DEL CLOSET</p><span>{String(data.garments.length).padStart(2, "0")}</span></header>
      <div className="public-garments-grid">{data.garments.map((garment) => <article key={garment.id}>
        <div><img src={garment.image} alt={garment.name} /></div>
        <h2>{garment.name}</h2>
        <p>{[garment.brand, garment.category, garment.tone].filter(Boolean).join(" · ")}</p>
      </article>)}</div>
    </section>}

    {data.outfits.length === 0 && data.garments.length === 0 && <section className="public-profile-empty"><p>Este perfil todavía no publicó prendas ni looks.</p></section>}
    <footer className="public-profile-footer"><a href="/">CREA TU CLOSET EN FORMÉ →</a><span>Tu estilo, leído desde lo que ya tienes.</span></footer>
  </main>;
}
