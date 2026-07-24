import Link from "next/link";
import { FormePublicHeader } from "./forme-public-header";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;

const storyScenes = [
  {
    id: "digitaliza",
    verb: "Digitaliza",
    line: <>Convierte tu ropa en un <em>archivo vivo.</em></>,
    body: "Sube una foto. Formé separa la prenda del fondo y conserva su forma, color y detalles.",
    image: "/wardrobe/clean/037_DSC01850.webp",
    alt: "Chaqueta transparente digitalizada en Formé",
  },
  {
    id: "combina",
    verb: "Combina",
    line: <>Mira un look antes de <em>ponértelo.</em></>,
    body: "Mueve, escala y superpone prendas en un canvas libre. Guarda las combinaciones que sí se sienten tuyas.",
    image: "/wardrobe/clean/022_DSC01810-open.webp",
    alt: "Chaqueta de fleece digitalizada y abierta en Formé",
  },
  {
    id: "entiende",
    verb: "Entiende",
    line: <>Descubre lo que repites y <em>por qué funciona.</em></>,
    body: "Formé lee tus elecciones para recomendar desde tu propio closet, no desde una tendencia genérica.",
    image: "/wardrobe/clean/045_DSC01875.webp",
    alt: "Chaqueta clara digitalizada en Formé",
  },
];

export function FormeLanding() {
  return (
    <main className="forme-landing">
      <FormePublicHeader tone="coral" />

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <p>Closet visual y asistente de estilo</p>
          <h1 id="landing-title">
            <span className="landing-title-line landing-title-line-one">Tu ropa ya</span>
            <span className="landing-title-line landing-title-line-two"><em>sabe</em> quién eres.</span>
          </h1>
          <span>Digitaliza lo que tienes, crea looks y descubre el sistema que ya existe en tu forma de vestir.</span>
        </div>

        <div
          className="landing-sculpture landing-sculpture-hero"
          role="img"
          aria-label="Prendas digitalizadas flotando en el espacio de Formé"
        >
          <img
            className="landing-garment landing-garment-main"
            src={asset("/wardrobe/clean/015_DSC01797-open.webp")}
            alt="Blazer gráfico negro digitalizado en Formé"
            width="1024"
            height="1280"
            loading="eager"
          />
        </div>

      </section>

      <section className="landing-statement" aria-label="La idea de Formé">
        <p>
          <span>No necesitas más ropa.</span>
          <span>Necesitas <em>ver mejor</em></span>
          <span>la que ya tienes.</span>
        </p>
        <img
          src={asset("/wardrobe/imports/2026-07-18/031_DSC01967.webp")}
          alt="Kimono estampado digitalizado en Formé"
          width="1024"
          height="1280"
          loading="lazy"
        />
      </section>

      <section id="como-funciona" className="landing-story" aria-labelledby="story-title">
        <header className="landing-story-intro">
          <p id="story-title">Un closet que puedes usar</p>
          <span>De la foto a una forma más clara de vestirte.</span>
        </header>

        <div className="landing-story-layout">
          <div className="landing-story-visual" aria-hidden="true">
            <span className="landing-visual-field" />
            <img src={asset("/wardrobe/clean/037_DSC01850.webp")} alt="" width="1024" height="1280" loading="lazy" />
          </div>

          <div className="landing-story-scenes">
            {storyScenes.map((scene) => (
              <article className="landing-story-scene" id={scene.id} key={scene.id}>
                <div>
                  <p>{scene.verb}</p>
                  <h2>{scene.line}</h2>
                  <span>{scene.body}</span>
                </div>
                <img src={asset(scene.image)} alt={scene.alt} width="1024" height="1280" loading="lazy" />
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-look" aria-labelledby="landing-look-title">
        <div className="landing-look-copy">
          <p>El canvas</p>
          <h2 id="landing-look-title">Vestirte también es <em>componer.</em></h2>
          <span>Prueba proporciones, capas y contrastes antes de abrir el closet físico.</span>
        </div>
        <figure className="landing-outfit" aria-label="Look completo compuesto con prendas digitalizadas">
          <img className="landing-outfit-top" src={asset("/wardrobe/clean/basic-white-tee.webp")} alt="Polo blanco" width="1024" height="1280" loading="lazy" />
          <img className="landing-outfit-jacket" src={asset("/wardrobe/clean/002_DSC01771-open.webp")} alt="Bomber negra abierta" width="1024" height="1280" loading="lazy" />
          <img className="landing-outfit-bottom" src={asset("/wardrobe/clean/blue-straight-jeans.webp")} alt="Jeans azules" width="1024" height="1280" loading="lazy" />
          <img className="landing-outfit-shoes" src={asset("/wardrobe/basics/white-sneakers.webp")} alt="Zapatillas blancas" width="1024" height="1280" loading="lazy" />
        </figure>
      </section>

      <section className="landing-final" aria-labelledby="landing-final-title">
        <div className="landing-final-sculpture" aria-hidden="true">
          <img src={asset("/wardrobe/clean/045_DSC01875.webp")} alt="" width="1024" height="1280" loading="lazy" />
          <span />
        </div>
        <p>Lo que eliges también habla.</p>
        <h2 id="landing-final-title">Conocerte,<br /><em>vistiéndote.</em></h2>
        <Link href="/closet">Abrir mi closet</Link>
      </section>

      <footer className="landing-footer">
        <Link className="landing-wordmark" href="/">FORMÉ<span>®</span></Link>
        <p>Tu estilo, leído desde lo que ya tienes.</p>
        <nav aria-label="Navegación secundaria">
          <Link href="/closet">Closet</Link>
          <Link href="/pricing">Planes</Link>
          <Link href="/about">Qué es Formé</Link>
        </nav>
      </footer>
    </main>
  );
}
