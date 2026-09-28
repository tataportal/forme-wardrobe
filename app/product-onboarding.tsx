"use client";

import { useEffect, useState } from "react";
import { starterGarments, type Garment } from "./garments";
import { REFERENCE_FRAME, slotPlacement } from "./garment-layout";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const garmentFor = (id: string) => starterGarments.find((item) => item.id === id) ?? starterGarments[0];
const imageFor = (id: string) => {
  const garment = garmentFor(id);
  return garment ? `${basePath}${garment.image}` : "";
};

const steps = [
  {
    label: "Tu cuenta",
    title: "Tu ropa. Leída de nuevo.",
    body: "Empieza con lo que ya tienes. Sube una prenda y conviértela en parte de tu closet digital.",
  },
  {
    label: "Tus fotos",
    title: "Fotografía la prenda, no la escena.",
    body: "Una buena foto nos permite respetar mejor la forma, el color y los detalles reales.",
  },
  {
    label: "Canvas",
    title: "Arma tus looks visualmente.",
    body: "Mueve, escala y combina tus prendas hasta encontrar una composición que funcione para ti.",
  },
  {
    label: "Nuevas combinaciones",
    title: "Explora lo que ya tienes.",
    body: "Guarda tus looks y úsalos como punto de partida para probar variaciones nuevas.",
  },
] as const;

function GarmentImage({ id, className = "" }: { id: string; className?: string }) {
  const garment = garmentFor(id) as Garment | undefined;
  return <img className={className} src={imageFor(id)} alt={garment?.name ?? "Prenda de ejemplo"} />;
}

type TourPiece = { id: string; variant?: "closed" | "open"; z: number };

function TourLook({ pieces }: { pieces: TourPiece[] }) {
  return <div className="product-tour-stage" aria-hidden="true">
    {pieces.map(({ id, variant = "closed", z }) => {
      const garment = garmentFor(id);
      if (!garment) return null;
      const resolvedVariant = variant === "open" && garment.openImage ? "open" : "closed";
      const placement = slotPlacement(garment, resolvedVariant, REFERENCE_FRAME);
      const source = resolvedVariant === "open" ? garment.openImage! : garment.image;
      return <img key={`${id}-${resolvedVariant}`} src={`${basePath}${source}`} alt="" style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        zIndex: z,
        transform: `translate(-50%, -50%) scale(${placement.scale})`,
      }} />;
    })}
  </div>;
}

function TourVisual({ step }: { step: number }) {
  if (step === 0) return <div className="product-tour-welcome">
    <TourLook pieces={[
      { id: "demo-w-023", z: 1 },
      { id: "demo-w-012", z: 2 },
      { id: "demo-w-034", z: 3 },
      { id: "demo-w-043", z: 4 },
    ]} />
  </div>;

  if (step === 1) return <div className="product-tour-photo" aria-hidden="true">
    <div className="product-tour-photo-field"><GarmentImage id="demo-w-004" /><i /></div>
    <ul><li>Luz pareja</li><li>Prenda completa</li><li>Extendida y de frente</li></ul>
  </div>;

  if (step === 2) return <div className="product-tour-canvas" aria-hidden="true">
    <TourLook pieces={[
      { id: "bottom-blue-jeans", z: 1 },
      { id: "top-basic-white-tee", z: 2 },
      { id: "archive-002", variant: "open", z: 3 },
      { id: "footwear-white-sneakers", z: 4 },
    ]} />
    <span className="tour-canvas-frame" />
  </div>;

  return <div className="product-tour-looks" aria-hidden="true">
    <TourLook pieces={[{ id: "demo-w-023", z: 1 }, { id: "demo-w-012", z: 2 }, { id: "demo-w-034", z: 3 }]} />
    <TourLook pieces={[{ id: "bottom-blue-jeans", z: 1 }, { id: "top-basic-white-tee", z: 2 }, { id: "archive-002", variant: "open", z: 3 }, { id: "footwear-white-sneakers", z: 4 }]} />
    <TourLook pieces={[{ id: "demo-w-024", z: 1 }, { id: "demo-w-014", z: 2 }, { id: "demo-w-037", z: 3 }, { id: "demo-w-043", z: 4 }]} />
  </div>;
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

  useEffect(() => {
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, []);

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
  const currentTitle = step === 0 && authenticated && alreadyCompleted ? "Tu ropa. Nuevas posibilidades." : current.title;
  return <div className="product-tour-backdrop" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
    <section className="product-tour-shell">
      <header className="product-tour-header">
        <strong>FORMÉ<sup>®</sup></strong>
        <span>{step + 1} / {steps.length}</span>
        <button type="button" onClick={onDismiss}>Ahora no</button>
      </header>

      <div className="product-tour-layout" key={step}>
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
          {step === 0 && <small>{authenticated ? alreadyCompleted ? "Tu saldo está activo. Este recorrido siempre estará disponible desde tu cuenta." : "10 créditos incluidos · +5 al completar el recorrido." : "10 créditos al registrarte · +5 al completar el recorrido."}</small>}
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
