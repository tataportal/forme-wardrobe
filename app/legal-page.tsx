import type { ReactNode } from "react";
import Link from "next/link";
import { FormePublicHeader } from "./forme-public-header";
import { LEGAL_DATE, LEGAL_VERSION, legalOperator, legalReady } from "../shared/legal";

export function LegalLinks() {
  return <nav className="legal-links" aria-label="Información legal"><Link href="/terminos">Términos de uso</Link><Link href="/privacidad">Privacidad y fotos</Link></nav>;
}
export function LegalContact() {
  const contact = legalOperator.email
    ? <a href={`mailto:${legalOperator.email}`}>{legalOperator.email}</a>
    : <a href={legalOperator.contactUrl} target="_blank" rel="noreferrer">{legalOperator.contactLabel}</a>;
  return <p>Servicio: {legalOperator.name}. País de operación: {legalOperator.country}. Contacto: {contact}.</p>;
}
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <main className="legal-page forme-app public-app"><FormePublicHeader />
    <article className="legal-document">
      {!legalReady && <p className="legal-draft" role="status">Borrador. Falta confirmar los datos del responsable antes de publicar.</p>}
      <header><p className="legal-date">Versión {LEGAL_VERSION} · {LEGAL_DATE}</p><h1>{title}</h1><p className="legal-intro">{intro}</p></header>
      {children}
      <LegalLinks />
    </article>
  </main>;
}
