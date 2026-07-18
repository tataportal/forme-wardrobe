import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qué es Formé | Closet digital y asistente de estilo",
  description: "Digitaliza tus prendas, arma looks y recibe recomendaciones que aprenden de ti.",
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function AboutPage() {
  return <main className="route-page about-page about-v2">
    <header className="route-header about-v2-nav">
      <a className="route-wordmark" href="/closet" aria-label="Formé, ir al closet">FORMÉ<span>®</span></a>
      <nav aria-label="Navegación principal">
        <a href="/closet">CLOSET</a>
        <a href="/pricing">PLANES</a>
        <a className="route-login" href="/auth/google/start?return_to=%2Fcloset">ENTRAR</a>
      </nav>
    </header>

    <section className="about-v2-hero">
      <div className="about-v2-hero-copy">
        <p>CLOSET DIGITAL Y ASISTENTE DE ESTILO</p>
        <h1>Vístete con lo que ya tienes.</h1>
        <span>Digitaliza tus prendas, arma looks y recibe recomendaciones que aprenden de ti.</span>
        <div className="about-v2-actions">
          <a className="primary" href="/closet">EXPLORAR FORMÉ <b>↗</b></a>
          <a href="/auth/google/start?return_to=%2Fcloset">CREAR MI CLOSET</a>
        </div>
      </div>

      <figure className="about-v2-outfit" aria-label="Un look creado con prendas digitalizadas en Formé">
        <div className="about-v2-outfit-stage">
          <img className="about-v2-piece about-v2-piece-tee" src={`${basePath}/wardrobe/cutouts/basic-white-tee.webp`} alt="Polo blanco digitalizado" />
          <img className="about-v2-piece about-v2-piece-jacket" src={`${basePath}/wardrobe/cutouts/002_DSC01771-open.webp`} alt="Bomber negra abierta digitalizada" />
          <img className="about-v2-piece about-v2-piece-jeans" src={`${basePath}/wardrobe/cutouts/blue-straight-jeans.webp`} alt="Jeans azules digitalizados" />
          <img className="about-v2-piece about-v2-piece-shoes" src={`${basePath}/wardrobe/basics/black-leather-shoes.webp`} alt="Zapatos negros digitalizados" />
        </div>
        <figcaption><span>UN CLOSET QUE PUEDES USAR</span><strong>Combina antes de vestirte.</strong></figcaption>
      </figure>
    </section>

    <section className="about-v2-product" aria-labelledby="about-product-title">
      <div className="about-v2-product-intro">
        <h2 id="about-product-title">Tu closet, por fin legible.</h2>
        <p>Formé convierte fotos comunes en un archivo visual que puedes usar todos los días.</p>
      </div>
      <div className="about-v2-capabilities">
        <article>
          <h3>Digitaliza</h3>
          <p>Sube varias prendas. Formé limpia cada imagen y conserva su forma, color y detalles.</p>
        </article>
        <article>
          <h3>Combina</h3>
          <p>Mueve, escala y superpone prendas en un canvas libre. Guarda cada look que funcione.</p>
        </article>
        <article>
          <h3>Aprende</h3>
          <p>Tu perfil, tus elecciones y tu closet hacen que cada recomendación sea más precisa y menos repetitiva.</p>
        </article>
      </div>
    </section>

    <section className="about-v2-manifesto">
      <p>LO QUE REPITES TAMBIÉN CUENTA UNA HISTORIA</p>
      <blockquote>Tu estilo no es lo que compras. Es lo que eliges cuando nadie te está diciendo qué ponerte.</blockquote>
      <div>
        <p>Cada prenda guarda una versión de ti. Formé te ayuda a verla, combinarla y seguir construyéndola.</p>
        <a href="/closet">ABRIR EL CLOSET <span>↗</span></a>
      </div>
    </section>

    <footer className="about-v2-footer">
      <a className="route-wordmark" href="/closet">FORMÉ<span>®</span></a>
      <p>Tu estilo, leído desde lo que ya tienes.</p>
      <nav><a href="/pricing">PLANES</a><a href="/closet">CLOSET</a></nav>
    </footer>
  </main>;
}
