"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type OnboardingStep = { label: string; title: string; body: string; captureLabel: string; capture: string | null };

const steps: readonly OnboardingStep[] = [
  {
    label: "Entra",
    title: "Todo empieza con tu closet.",
    body: "Crea tu cuenta y empieza con 10 créditos para digitalizar tus primeras prendas.",
    captureLabel: "Ingreso / cuenta",
    capture: null,
  },
  {
    label: "Sube",
    title: "Fotografía la prenda, no la escena.",
    body: "Luz pareja. Prenda completa, extendida y de frente. Puedes subir hasta 15 fotos juntas.",
    captureLabel: "Carga de prendas",
    capture: null,
  },
  {
    label: "Arma",
    title: "Tu ropa, en movimiento.",
    body: "En el Canvas, toca una prenda para seleccionarla. Mueve, reemplaza y arma tu look.",
    captureLabel: "Canvas / armado",
    capture: null,
  },
  {
    label: "Explora",
    title: "Nuevas combinaciones. Misma ropa.",
    body: "Guarda tus looks y vuelve a mezclarlos cuando quieras ver tu closet de otra manera.",
    captureLabel: "Looks / combinaciones",
    capture: null,
  },
];

function TourVisual({ step }: { step: number }) {
  const current = steps[step];
  return <figure className="product-tour-capture">
    {current.capture
      ? <img src={current.capture} alt={`Captura del paso ${step + 1}: ${current.captureLabel}`} />
      : <div className="product-tour-capture-slot" aria-label={`Espacio para captura: ${current.captureLabel}`}>
          <span>Captura {String(step + 1).padStart(2, "0")}</span>
          <strong>{current.captureLabel}</strong>
          <small>pendiente</small>
        </div>}
    <figcaption>[ {current.captureLabel} ]</figcaption>
  </figure>;
}

export function ProductOnboarding({
  authenticated,
  alreadyCompleted,
  initialStep = 0,
  onSignIn,
  onComplete,
  onDismiss,
  onFinish,
}: {
  authenticated: boolean;
  alreadyCompleted: boolean;
  initialStep?: number;
  onSignIn(): void;
  onComplete(): Promise<{ rewarded: boolean; credits: number }>;
  onDismiss(): void;
  onFinish(): void;
}) {
  const safeInitialStep = Math.max(0, Math.min(steps.length - 1, initialStep));
  const [step, setStep] = useState(safeInitialStep);
  const [furthestStep, setFurthestStep] = useState(safeInitialStep);
  const [claiming, setClaiming] = useState(false);
  const [reward, setReward] = useState<{ rewarded: boolean; credits: number } | null>(null);
  const [error, setError] = useState("");
  const layoutRef = useRef<HTMLDivElement>(null);
  const motionFrame = useRef<number | null>(null);

  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
      if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    };
  }, []);

  const moveTour = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || !layoutRef.current) return;
    const layout = layoutRef.current;
    const rect = layout.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const dx = (x / rect.width - 0.5) * 34;
    const dy = (y / rect.height - 0.5) * 24;
    if (motionFrame.current !== null) cancelAnimationFrame(motionFrame.current);
    motionFrame.current = requestAnimationFrame(() => {
      layout.style.setProperty("--tour-guide-x", `${x}px`);
      layout.style.setProperty("--tour-guide-y", `${y}px`);
      layout.style.setProperty("--tour-photo-x", `${dx}px`);
      layout.style.setProperty("--tour-photo-y", `${dy}px`);
    });
  };

  const resetTour = () => {
    const layout = layoutRef.current;
    if (!layout) return;
    layout.style.removeProperty("--tour-guide-x");
    layout.style.removeProperty("--tour-guide-y");
    layout.style.removeProperty("--tour-photo-x");
    layout.style.removeProperty("--tour-photo-y");
  };

  const next = () => {
    if (step === 0 && !authenticated) {
      onSignIn();
      return;
    }
    const nextStep = Math.min(steps.length - 1, step + 1);
    setStep(nextStep);
    setFurthestStep((value) => Math.max(value, nextStep));
  };

  const finish = async () => {
    if (alreadyCompleted) {
      onFinish();
      return;
    }
    setClaiming(true);
    setError("");
    try {
      setReward(await onComplete());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos activar tus créditos. Intenta otra vez.");
    } finally {
      setClaiming(false);
    }
  };

  const current = steps[step];
  const currentTitle = current.title;
  return <div className="product-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
    <section className="product-tour-shell">
      <header className="product-tour-header">
        <strong>FORMÉ<sup>®</sup></strong>
        <span>{step + 1} / {steps.length}</span>
        <button type="button" onClick={onDismiss}>Ahora no</button>
      </header>

      <div ref={layoutRef} className="product-tour-layout" key={step} onPointerMove={moveTour} onPointerLeave={resetTour}>
        <aside className="product-tour-index" aria-label="Pasos del tutorial">
          {steps.map((item, index) => <button
            key={item.label}
            type="button"
            className={index === step ? "active" : ""}
            disabled={index > furthestStep}
            onClick={() => setStep(index)}
          ><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}
        </aside>

        <div className="product-tour-visual"><TourVisual step={step} /></div>

        <div className="product-tour-copy">
          <span>{current.label}</span>
          <h1 id="product-tour-title">{currentTitle}</h1>
          <p>{current.body}</p>
          {step === 0 && <small>{authenticated ? alreadyCompleted ? "Tu saldo está activo. Puedes volver a este recorrido desde tu cuenta." : "10 créditos incluidos al crear tu cuenta." : "10 créditos incluidos al registrarte."}</small>}
          {step === 3 && !reward && <small>Completa este recorrido y recibe 5 créditos adicionales.</small>}
          {reward && <div className="product-tour-reward" role="status"><strong>+5</strong><span>{reward.rewarded ? "créditos añadidos" : "créditos ya activados"}</span><small>Saldo: {reward.credits}</small></div>}
          {error && <p className="product-tour-error" role="alert">{error}</p>}
          <div className="product-tour-actions">
            {step > 0 && !reward && <button type="button" className="secondary-action" onClick={() => setStep((value) => value - 1)}>Atrás</button>}
            {!reward && <button type="button" className="primary-action" disabled={claiming} onClick={step === steps.length - 1 ? () => void finish() : next}>
              {claiming ? "Activando…" : step === 0 && !authenticated ? "Entrar con Google" : step === steps.length - 1 ? alreadyCompleted ? "Volver a Formé" : "Completar y recibir 5" : "Siguiente"}
            </button>}
            {reward && <button type="button" className="primary-action" onClick={onFinish}>Subir mis primeras prendas</button>}
          </div>
        </div>
      </div>
    </section>
  </div>;
}
