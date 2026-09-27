"use client";

import { useState } from "react";
import { FormePublicHeader } from "../forme-public-header";

type BillingCycle = "monthly" | "annual";

const annualDiscount = 0.1;
const plans = [
  { id: "personal", name: "Personal", monthlyPrice: 7.99, features: ["Hasta 75 prendas", "15 prendas nuevas al mes", "Canvas y looks guardados", "Perfil público opcional"], recommended: true },
  { id: "club", name: "Club", monthlyPrice: 12.99, features: ["Hasta 250 prendas", "40 prendas nuevas al mes", "3 mejoras de imagen", "Canvas y looks guardados"] },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  return <main className="route-page pricing-page forme-app public-app">
    <FormePublicHeader />
    <section className="pricing-page-content">
      <div className="pricing-intro"><h1>Gratis durante la beta</h1><span>Usa tu closet y guarda looks sin tarjeta ni cobros.</span></div>
      <a className="primary-action pricing-start" href="/closet">Abrir mi closet</a>
      <details className="pricing-future"><summary>Planes previstos</summary><p>Estos planes aún no están disponibles.</p>
      <div className="pricing-cycle" aria-label="Frecuencia de pago">
        <button type="button" className={billingCycle === "monthly" ? "active" : ""} aria-pressed={billingCycle === "monthly"} onClick={() => setBillingCycle("monthly")}>Mensual</button>
        <button type="button" className={billingCycle === "annual" ? "active" : ""} aria-pressed={billingCycle === "annual"} onClick={() => setBillingCycle("annual")}>Anual <b>-10%</b></button>
      </div>
      {billingCycle === "annual" && <p className="pricing-cycle-note">Pago anual único. El precio mensual es una referencia.</p>}
      <div className="pricing-plan-list">
        {plans.map((plan) => {
          const annualTotal = plan.monthlyPrice * 12 * (1 - annualDiscount);
          const displayedMonthlyPrice = billingCycle === "annual" ? annualTotal / 12 : plan.monthlyPrice;
          return <article className={plan.recommended ? "recommended" : ""} key={plan.id}>
            <div className="pricing-plan-heading"><h2>{plan.name}</h2><div className="pricing-plan-price"><strong>US${displayedMonthlyPrice.toFixed(2)}</strong><span>/ mes</span></div></div>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            {billingCycle === "annual" && <small>Cobro único de US${annualTotal.toFixed(2)} por todo el año.</small>}
          </article>;
        })}
      </div>
      </details>
    </section>
  </main>;
}
