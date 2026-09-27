"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fitLookPreview, type PreviewBounds } from "../look-preview";
import { FormePublicHeader } from "../forme-public-header";

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
  bounds?: PreviewBounds;
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
    {fitLookPreview(look.items, item => item.bounds).sort((a, b) => a.z - b.z).map((item) => <img
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

function PublicLookPieces({ look }: { look: PublicLook }) {
  return <ul className="public-look-pieces" aria-label={`${look.items.length} prendas en ${look.name}`}>
    {[...look.items].sort((a, b) => a.z - b.z).map((item) => <li key={item.instanceId}>
      <img src={item.image} alt="" loading="lazy" />
    </li>)}
  </ul>;
}

export default function PublicProfilePage() {
  const params = useParams<{ handle: string }>();
  const rawHandle = typeof params?.handle === "string" ? decodeURIComponent(params.handle) : "";
  const handle = rawHandle.replace(/^@/, "");
  const invalidHandle = !rawHandle.startsWith("@") || !handle;
  const [data, setData] = useState<PublicProfilePayload | null>(null);
  const [error, setError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const initials = useMemo(() => data?.profile.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toLocaleUpperCase() || "F", [data]);

  useEffect(() => {
    if (invalidHandle) return;
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
  }, [handle, invalidHandle]);

  async function shareProfile() {
    if (!data) return;
    const payload = { title: `${data.profile.name} en Formé`, text: `Mira el closet de ${data.profile.name}`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(payload);
      else { await navigator.clipboard.writeText(window.location.href); setShareNotice("Enlace copiado"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setShareNotice("No se pudo compartir. Puedes copiar el enlace de esta página.");
    }
  }

  if (invalidHandle || loading || !data) return <main className="public-profile-page forme-app public-app">
    <FormePublicHeader />
    <div className="public-profile-frame"><section className="public-profile-status">
      {!invalidHandle && loading ? <p role="status">Abriendo perfil…</p> : <>
        <h1>Perfil no disponible</h1>{!invalidHandle && <p>{error}</p>}<Link href="/closet">Volver a Formé</Link>
      </>}
    </section></div>
  </main>;

  return <main className="public-profile-page forme-app public-app">
    <FormePublicHeader />
    <div className="public-profile-frame">
      {shareNotice && <p role="status">{shareNotice}</p>}
      <section className="public-profile-hero">
        <div className="public-profile-avatar">{data.profile.avatarUrl ? <img src={data.profile.avatarUrl} alt={`Foto de ${data.profile.name}`} /> : <span>{initials}</span>}</div>
        <div className="public-profile-copy">
          <p>{data.profile.handle}</p>
          <h1>{data.profile.name}</h1>
          {data.profile.bio && <span>{data.profile.bio}</span>}
          <div className="profile-page-links"><button type="button" onClick={() => void shareProfile()}>Compartir</button></div>
        </div>
        <dl className="profile-page-stats">
          <div><dt>Prendas</dt><dd>{data.garments.length}</dd></div>
          <div><dt>Looks</dt><dd>{data.outfits.length}</dd></div>
        </dl>
      </section>

      {data.outfits.length > 0 && <section className="public-profile-section">
        <header><h2>Looks</h2><span>{data.outfits.length}</span></header>
        <div className="public-looks-grid">{data.outfits.map((look) => <article key={look.id}><PublicLookPreview look={look} /><h2>{look.name}</h2><PublicLookPieces look={look} /></article>)}</div>
      </section>}

      {data.garments.length > 0 && <section className="public-profile-section">
        <header><h2>Prendas</h2><span>{data.garments.length}</span></header>
        <div className="public-garments-grid">{data.garments.map((garment) => <article key={garment.id} tabIndex={0} aria-label={garment.name}>
          <div><img src={garment.image} alt={garment.name} /></div>
          <span className="public-garment-caption">{garment.name}</span>
        </article>)}</div>
      </section>}

      {data.outfits.length === 0 && data.garments.length === 0
        ? <section className="public-profile-empty"><p>Aún no hay prendas ni looks publicados.</p><Link href="/closet">Crea tu closet en Formé</Link></section>
        : <footer className="public-profile-footer"><Link href="/closet">Crea tu closet en Formé</Link></footer>}
    </div>
  </main>;
}
