"use client";

import { useState, type FocusEvent } from "react";

type AccountCreditsProps = {
  credits?: number;
  creditsUsed?: number;
  onboardingCompleted?: boolean;
  onTutorial(): void;
};

export function AccountCredits({ credits, creditsUsed, onboardingCompleted, onTutorial }: AccountCreditsProps) {
  const [open, setOpen] = useState(false);
  const closeAfterBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return <div className="account-credits" onBlur={closeAfterBlur} onKeyDown={(event) => {
    if (event.key === "Escape") setOpen(false);
  }}>
    <button
      type="button"
      className="credits-trigger"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`${credits ?? "Consultando"} créditos disponibles`}
      onClick={() => setOpen((value) => !value)}
    >
      <span aria-hidden="true">●</span>
      <strong>{credits ?? "—"}</strong>
      <em>créditos</em>
    </button>
    {open && <div className="credits-summary" role="dialog" aria-label="Resumen de créditos">
      <header><span>Créditos</span><strong>{credits ?? "—"}</strong></header>
      <p>{creditsUsed ?? 0} usados en digitalizaciones</p>
      <button type="button" onClick={() => { setOpen(false); onTutorial(); }}>{onboardingCompleted ? "Ver tutorial" : "Ver tutorial · gana 5"}</button>
    </div>}
  </div>;
}
