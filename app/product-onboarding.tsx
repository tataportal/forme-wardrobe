"use client";

import { useEffect, useState } from "react";
import { formeBasics, type Garment } from "./garments";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const imageFor = (id: string) => {
  const garment = formeBasics.find((item) => item.id === id) ?? formeBasics[0];
  return garment ? `${basePath}${garment.image}` : "";
};

const steps = [
  {
    label: "Tu cuenta",
    title: "Empieza con 10 créditos.",
    body: "Entra a Formé y convierte tus primeras prendas en un closet digital listo para combinar.",
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
  const garment = formeBasics.find((item) => item.id === id) as Garment | undefined;
  return <img className={className} src={imageFor(id)} alt={garment?.name ?? "Prenda de ejemplo"} />;
}

function TourVisual({ step }: { step: number }) {
  if (step === 0) return <div className="product-tour-welcome" aria-hidden="true">
    <GarmentImage id="demo-w-003" />
    <GarmentImage id="top-basic-white-tee" />
    <GarmentImage id="bottom-blue-jeans" />
    <span>10</span><small>créditos para empezar</small>
  </div>;

  if (step === 1) return <div className="product-tour-photo" aria-hidden="true">
    <div className="product-tour-photo-field"><GarmentImage id="demo-w-004" /><i /></div>
    <ul><li>Luz pareja</li><li>Prenda completa</li><li>Extendida y de frente</li></ul>
  </div>;

  if (step === 2) return <div className="product-tour-canvas" aria-hidden="true">
    <GarmentImage id="bottom-blue-jeans" className="tour-look-bottom" />
    <GarmentImage id="top-basic-white-tee" className="tour-look-top" />
    <GarmentImage id="demo-w-002" className="tour-look-outer" />
    <GarmentImage id="footwear-white-sneakers" className="tour-look-shoes" />
    <span className="tour-canvas-frame" />
  </div>;

  return <div className="product-tour-looks" aria-hidden="true">
    <div><GarmentImage id="demo-w-001" /><GarmentImage id="bottom-black-trouser" /><GarmentImage id="footwear-black-pumps" /></div>
    <div><GarmentImage id="demo-w-003" /><GarmentImage id="bottom-blue-jeans" /><GarmentImage id="footwear-white-sneakers" /></div>
    <div><GarmentImage id="demo-w-004" /><GarmentImage id="bottom-stone-chino" /><GarmentImage id="accessory-black-tote" /></div>
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
          <h1 id="product-tour-title">{current.title}</h1>
          <p>{current.body}</p>
          {step === 0 && <small>{authenticated ? alreadyCompleted ? "Tu saldo está activo y puedes volver a este tutorial cuando quieras." : "Ya estás dentro. Tus 10 créditos están activos." : "Al registrarte recibes 10 créditos."}</small>}
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
