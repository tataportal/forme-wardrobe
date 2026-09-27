import Link from "next/link";
import { productFeatures } from "./product-features";

export function FormePublicHeader({
  tone = "light",
}: {
  tone?: "light" | "coral";
}) {
  return (
    <header className={`public-header public-header-${tone}`}>
      <Link className="public-wordmark" href="/" aria-label="Formé, inicio">
        FORMÉ<span>®</span>
      </Link>
      <nav className="public-navigation" aria-label="Navegación principal">
        <Link href="/closet">Mi closet</Link>
        <Link href="/canvas">Canvas</Link>
        <Link href="/looks">Looks</Link>
        {productFeatures.assistant && <Link href="/asistente">Asistente</Link>}
      </nav>
      <Link className="public-account-entry" href="/perfil">Mi cuenta</Link>
    </header>
  );
}
