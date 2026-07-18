"use client";

import { useState } from "react";
import Link from "next/link";

type BillingCycle = "monthly" | "annual";

const annualDiscount = 0.1;
const plans = [
  { id: "free", name: "Libre", monthlyPrice: 0, description: "Para conocer tu closet y empezar a combinar.", features: ["Hasta 15 prendas", "5 looks guardados", "Canvas y básicos Formé", "Perfil compartible"] },
  { id: "personal", name: "Personal", monthlyPrice: 7.99, description: "Para vestir mejor con lo que ya tienes.", features: ["Hasta 75 prendas", "15 prendas nuevas al mes", "Looks y planificación semanal", "Asistente según tu estilo y closet"], recommended: true },
  { id: "club", name: "Club", monthlyPrice: 12.99, description: "Para closets grandes y una lectura más profunda.", features: ["Hasta 250 prendas", "40 prendas nuevas al mes", "3 reprocesos en calidad media", "Prioridad, análisis e insights avanzados"] },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  return <main className="route-page pricing-page forme-v2 public-v2">
    <header className="route-header">
      <Link className="route-wordmark" href="/closet">FORMÉ<span>®</span></Link>
      <nav><Link href="/about">ACERCA</Link><Link href="/closet">CLOSET</Link><Link className="route-login" href="/auth/google/start?return_to=%2Fcloset">ENTRAR</Link></nav>
    </header>
    <section className="pricing-page-content">
      <div className="pricing-intro"><p>PLANES</p><h1>Un plan para cada closet.</h1><span>Empieza gratis. Sube más prendas cuando Formé ya sea parte de tu rutina.</span></div>
      <div className="pricing-cycle" aria-label="Frecuencia de pago">
        <button type="button" className={billingCycle === "monthly" ? "active" : ""} onClick={() => setBillingCycle("monthly")}>MENSUAL</button>
        <button type="button" className={billingCycle === "annual" ? "active" : ""} onClick={() => setBillingCycle("annual")}>ANUAL <b>−10%</b></button>
      </div>
      {billingCycle === "annual" && <p className="pricing-cycle-note">El plan anual se cobra completo una vez al año.</p>}
      <div className="pricing-plan-list">
        {plans.map((plan) => {
          const annualTotal = plan.monthlyPrice * 12 * (1 - annualDiscount);
          const displayedMonthlyPrice = billingCycle === "annual" ? annualTotal / 12 : plan.monthlyPrice;
          return <article className={plan.recommended ? "recommended" : ""} key={plan.id}>
            <div className="pricing-plan-heading"><div><p>{plan.recommended ? "RECOMENDADO" : plan.id === "free" ? "EMPIEZA AQUÍ" : "MÁS CAPACIDAD"}</p><h3>{plan.name}</h3></div><div className="pricing-plan-price"><strong>${displayedMonthlyPrice.toFixed(plan.monthlyPrice === 0 ? 0 : 2)}</strong><span>/ mes</span></div></div>
            <p className="pricing-plan-description">{plan.description}</p>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            {billingCycle === "annual" && plan.monthlyPrice > 0 && <small>Cobro único de US${annualTotal.toFixed(2)} por todo el año.</small>}
            <button type="button" disabled>{plan.id === "free" ? "INCLUIDO EN BETA" : "PRÓXIMAMENTE"}</button>
          </article>;
        })}
      </div>
      <p className="pricing-beta-note">Durante la beta no se harán cobros. Estos son los planes recomendados antes de activar pagos.</p>
    </section>
  </main>;
}
