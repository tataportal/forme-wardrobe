"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { FormePublicHeader } from "../forme-public-header";

type BillingCycle = "monthly" | "annual";
type OfferId = "personal" | "club" | "pack-10" | "pack-50";

const plans = [
  { id: "personal" as const, name: "Personal", monthly: 7.99, annual: 79.99, description: "Para convertir tu closet real en algo que sí puedes usar cada día.", features: ["75 prendas guardadas", "15 digitalizaciones al mes", "Canvas automático", "Looks ilimitados"] },
  { id: "club" as const, name: "Club", monthly: 12.99, annual: 129.99, description: "Para closets grandes y para quienes agregan prendas con frecuencia.", features: ["250 prendas guardadas", "40 digitalizaciones al mes", "Canvas automático", "Looks ilimitados"] },
];

const offerNames: Record<OfferId, string> = { personal: "Personal", club: "Club", "pack-10": "Pack de 10", "pack-50": "Pack de 50" };

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selected, setSelected] = useState<OfferId | null>(null);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const selectedCycle = useMemo(() => selected?.startsWith("pack-") ? "once" : billingCycle, [selected, billingCycle]);

  function choose(offer: OfferId) {
    setSelected(offer);
    setStatus("idle");
    setMessage("");
    requestAnimationFrame(() => document.querySelector(".pricing-activation")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setStatus("sending");
    setMessage("");
    const response = await fetch("/api/sales-interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, company, planId: selected, billingCycle: selectedCycle }),
    });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setStatus("error");
      setMessage(payload.error || "No pudimos guardar tu solicitud. Intenta otra vez.");
      return;
    }
    setStatus("sent");
    setMessage(`Listo. Te avisaremos cuando el checkout de ${offerNames[selected]} esté disponible.`);
  }

  return <main className="route-page pricing-page forme-app public-app">
    <FormePublicHeader />
    <section className="pricing-page-content">
      <header className="pricing-intro">
        <h1>Tu closet,<br />listo para usar.</h1>
        <span>Sube una foto. Formé la convierte en una prenda limpia, la ordena y te ayuda a armar el look.</span>
        <Link className="primary-action pricing-start" href="/closet">Probar gratis</Link>
      </header>

      <div className="pricing-garment-rail" aria-label="Prendas digitalizadas con Formé">
        <img src="/wardrobe/final/0000207.png" alt="Prenda digitalizada, vista frontal" />
        <img src="/wardrobe/final/0000100.png" alt="Prenda digitalizada, vista frontal" />
        <img src="/wardrobe/final/0000174.png" alt="Prenda digitalizada, vista frontal" />
      </div>

      <section className="pricing-free" aria-labelledby="free-title">
        <div><h2 id="free-title">Empieza gratis</h2><p>15 prendas de por vida y hasta 5 looks guardados. Sin tarjeta.</p></div>
        <Link href="/ingresar?return_to=%2Fcloset">Crear mi closet</Link>
      </section>

      <section className="pricing-paid" aria-labelledby="plans-title">
        <div className="pricing-section-heading">
          <h2 id="plans-title">Cuando tu closet crece</h2>
          <div className="pricing-cycle" aria-label="Frecuencia de pago">
            <button type="button" className={billingCycle === "monthly" ? "active" : ""} aria-pressed={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")}>Mensual</button>
            <button type="button" className={billingCycle === "annual" ? "active" : ""} aria-pressed={billingCycle === "annual"} onClick={() => setBillingCycle("annual")}>Anual</button>
          </div>
        </div>

        <div className="pricing-plan-list">
          {plans.map((plan) => {
            const price = billingCycle === "annual" ? plan.annual / 12 : plan.monthly;
            return <article key={plan.id}>
              <div className="pricing-plan-copy"><h3>{plan.name}</h3><p>{plan.description}</p></div>
              <div className="pricing-plan-price"><strong>US${price.toFixed(2)}</strong><span>/ mes</span>{billingCycle === "annual" && <small>US${plan.annual.toFixed(2)} al año</small>}</div>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
              <button type="button" onClick={() => choose(plan.id)}>Elegir {plan.name}</button>
            </article>;
          })}
        </div>
      </section>

      <section className="pricing-packs" aria-labelledby="packs-title">
        <div><h2 id="packs-title">Créditos extra</h2><p>Para digitalizar más prendas sin cambiar de plan.</p></div>
        <button type="button" onClick={() => choose("pack-10")}><span>10 prendas</span><strong>US$2.99</strong></button>
        <button type="button" onClick={() => choose("pack-50")}><span>50 prendas</span><strong>US$9.99</strong></button>
      </section>

      {selected && <section className="pricing-activation" aria-live="polite">
        <div><h2>{offerNames[selected]}</h2><p>La pasarela todavía no está activa. Déjanos tu correo y te avisaremos cuando puedas pagar.</p></div>
        {status === "sent" ? <p className="pricing-success">{message}</p> : <form onSubmit={submit}>
          <label>Correo<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <p className="pricing-terms">Usaremos tus datos para responder esta solicitud. Consulta la <Link href="/privacidad">Política de privacidad</Link>.</p>
          <label className="pricing-honeypot" aria-hidden="true">Empresa<input value={company} onChange={(event) => setCompany(event.target.value)} tabIndex={-1} autoComplete="off" /></label>
          <button className="primary-action" disabled={status === "sending"}>{status === "sending" ? "Enviando..." : "Avisarme"}</button>
          {status === "error" && <p className="pricing-error" role="alert">{message}</p>}
        </form>}
      </section>}

      <p className="pricing-terms"><Link href="/terminos">Términos de uso</Link> · <Link href="/privacidad">Privacidad y fotos</Link></p>
      <p className="pricing-terms">Un crédito se descuenta solo cuando la prenda queda lista. Los reintentos del sistema no consumen créditos. Puedes cancelar el plan cuando quieras.</p>
    </section>
  </main>;
}
