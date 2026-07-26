import Link from "next/link";
import { FormePublicHeader } from "./forme-public-header";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const asset = (path: string) => `${basePath}${path}`;

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
          <span>Digitaliza lo que tienes, crea looks y entiende mejor tu forma de vestir.</span>
          <Link className="landing-primary" href="/closet">Abrir mi closet</Link>
        </div>

        <div
          className="landing-sculpture landing-sculpture-hero"
          role="img"
          aria-label="Prenda digitalizada en Formé"
        >
          <img
            className="landing-garment landing-garment-main"
            src={asset("/wardrobe/clean/015_DSC01797.webp")}
            alt="Blazer gráfico negro digitalizado en Formé"
            width="1024"
            height="1280"
            loading="eager"
          />
        </div>
      </section>
    </main>
  );
}
