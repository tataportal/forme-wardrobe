import type { Metadata } from "next";
import Link from "next/link";
import { FormePublicHeader } from "../forme-public-header";

export const metadata: Metadata = {
  title: "Qué es Formé | Closet digital y asistente de estilo",
  description: "Digitaliza tus prendas, arma looks y recibe recomendaciones que aprenden de ti.",
};

export default function AboutPage() {
  return (
    <main className="route-page about-page public-app">
      <FormePublicHeader />
      <section className="about-minimal-hero">
        <div>
          <h1>Tu ropa ya tiene un lenguaje.</h1>
          <p>Formé convierte tu closet en una herramienta para combinar mejor lo que ya tienes.</p>
          <Link href="/closet">Abrir mi closet</Link>
        </div>
        <figure>
          <img
            src="/wardrobe/clean/015_DSC01797.webp"
            alt="Blazer negro digitalizado en Formé"
            width="1024"
            height="1280"
          />
        </figure>
      </section>
      <section className="about-minimal-system" aria-labelledby="about-system-title">
        <h2 id="about-system-title">Un closet que aprende contigo.</h2>
        <div>
          <article>
            <h3>Digitaliza</h3>
            <p>Guarda cada prenda como una imagen limpia, completa y lista para combinar.</p>
          </article>
          <article>
            <h3>Combina</h3>
            <p>Construye looks en el Canvas y vuelve a ellos cuando necesites decidir rápido.</p>
          </article>
          <article>
            <h3>Entiende</h3>
            <p>El Asistente usa tu perfil, tu closet y tus elecciones para responder mejor.</p>
          </article>
        </div>
      </section>
    </main>
  );
}
