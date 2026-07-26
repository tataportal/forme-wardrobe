"use client";

import { useState } from "react";
import { FormePublicHeader } from "../forme-public-header";

type BillingCycle = "monthly" | "annual";

const annualDiscount = 0.1;
const plans = [
  { id: "personal", name: "Personal", monthlyPrice: 7.99, description: "Para vestir mejor con lo que ya tienes.", features: ["Hasta 75 prendas", "15 prendas nuevas al mes", "Looks y planificación semanal", "Asistente según tu estilo y closet"], recommended: true },
  { id: "club", name: "Club", monthlyPrice: 12.99, description: "Para closets grandes y una lectura más profunda.", features: ["Hasta 250 prendas", "40 prendas nuevas al mes", "3 reprocesos en calidad media", "Prioridad, análisis e insights avanzados"] },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  return <main className="route-page pricing-page forme-app public-app">
    <FormePublicHeader />
    <section className="pricing-page-content">
      <div className="pricing-intro"><h1>Elige cuánto quieres guardar.</h1><span>Dos planes para closets reales. Durante la beta no se harán cobros.</span></div>
      <div className="pricing-cycle" aria-label="Frecuencia de pago">
        <button type="button" className={billingCycle === "monthly" ? "active" : ""} onClick={() => setBillingCycle("monthly")}>Mensual</button>
        <button type="button" className={billingCycle === "annual" ? "active" : ""} onClick={() => setBillingCycle("annual")}>Anual <b>-10%</b></button>
      </div>
      {billingCycle === "annual" && <p className="pricing-cycle-note">El plan anual se cobra completo una vez al año.</p>}
      <div className="pricing-plan-list">
        {plans.map((plan) => {
          const annualTotal = plan.monthlyPrice * 12 * (1 - annualDiscount);
          const displayedMonthlyPrice = billingCycle === "annual" ? annualTotal / 12 : plan.monthlyPrice;
          return <article className={plan.recommended ? "recommended" : ""} key={plan.id}>
            <div className="pricing-plan-heading"><h3>{plan.name}</h3><div className="pricing-plan-price"><strong>US${displayedMonthlyPrice.toFixed(2)}</strong><span>/ mes</span></div></div>
            <p className="pricing-plan-description">{plan.description}</p>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            {billingCycle === "annual" && <small>Cobro único de US${annualTotal.toFixed(2)} por todo el año.</small>}
            <button type="button" disabled>Próximamente</button>
          </article>;
        })}
      </div>
      <p className="pricing-beta-note">Puedes usar Formé durante la beta sin ingresar un método de pago.</p>
    </section>
  </main>;
}
