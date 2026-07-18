import Image from "next/image";

export default function AboutPage() {
  return <main className="route-page about-page">
    <header className="route-header">
      <a className="route-wordmark" href="/closet">FORMÉ<span>®</span></a>
      <nav><a href="/closet">CLOSET</a><a href="/pricing">PLANES</a><a className="route-login" href="/auth/google/start?return_to=%2Fcloset">ENTRAR</a></nav>
    </header>
    <section className="about-hero">
      <div className="about-hero-copy">
        <p>SOBRE FORMÉ</p>
        <h1>Nadie te enseña a leer tu propio closet.</h1>
        <span>Pero ahí está todo: la persona que eras, la que eres hoy y la que todavía estás construyendo.</span>
      </div>
      <figure className="about-hero-wardrobe" aria-label="Selección de prendas de un closet Formé">
        <Image src="/wardrobe/clean/029_DSC01830-open.webp" alt="Chaqueta negra abierta" width={900} height={1125} priority />
        <Image src="/wardrobe/clean/032_DSC01838-open.webp" alt="Abrigo negro abierto" width={900} height={1125} priority />
        <Image src="/wardrobe/clean/049_DSC01884-open.webp" alt="Chaqueta gráfica abierta" width={900} height={1125} priority />
      </figure>
    </section>
    <section className="about-story">
      <p>Tu estilo no es lo que compras. Es lo que repites sin pensarlo, lo que guardas aunque ya no uses y lo que encuentras cuando no sabes qué ponerte.</p>
      <p>Formé convierte las fotos de tus prendas en un armario visual. Desde ahí puedes combinar libremente, guardar looks, planear tu semana y recibir recomendaciones explicadas desde lo que ya tienes.</p>
      <p>Con el tiempo, el sistema aprende de lo que eliges, descartas y realmente usas. No de una tendencia abstracta: de ti.</p>
      <blockquote>Porque descubrirse no es una sola revelación. Es un diálogo constante entre quien ya eres y quien todavía estás construyendo.</blockquote>
    </section>
    <section className="about-cta"><p>EMPIEZA CON LO QUE YA TIENES</p><h2>Tu closet es el punto de partida.</h2><a href="/closet">PROBAR FORMÉ →</a></section>
  </main>;
}
