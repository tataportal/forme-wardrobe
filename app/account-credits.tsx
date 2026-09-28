"use client";

import { useState } from "react";

export function AccountCredits({ credits, creditsUsed, onTutorial }: { credits?: number; creditsUsed?: number; onTutorial: () => void }) {
  const [open, setOpen] = useState(false);
  return <div className="account-credits" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" className="credits-trigger" aria-expanded={open} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} aria-label={`${credits ?? "Consultando"} créditos disponibles`}><strong>{credits ?? "—"}</strong> créditos</button>
    {open && <div className="credits-summary"><strong>Tus créditos</strong><dl><div><dt>Disponibles</dt><dd>{credits ?? "—"}</dd></div><div><dt>Usados en digitalizaciones</dt><dd>{creditsUsed ?? "—"}</dd></div></dl><button type="button" onClick={() => { setOpen(false); onTutorial(); }}>Ver tutorial animado ↗</button></div>}
  </div>;
}
