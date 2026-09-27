"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function FormeMenu({ label, children, trigger }: { label: string; children: ReactNode; trigger?: ReactNode }) {
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target) && root.current) root.current.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  return <details className="forme-menu" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && root.current?.open) {
      event.stopPropagation(); root.current.open = false; root.current.querySelector("summary")?.focus();
    }
  }}>
    <summary aria-label={label} title={label}>{trigger ?? "···"}</summary>
    <div className="forme-menu-content" role="group" aria-label={label} onClick={event => {
      if (event.target instanceof Element && event.target.closest("button:not(:disabled)") && root.current) root.current.open = false;
    }}>{children}</div>
  </details>;
}
