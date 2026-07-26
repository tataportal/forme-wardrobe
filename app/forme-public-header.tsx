import Link from "next/link";

export function FormePublicHeader({
  tone = "light",
}: {
  tone?: "light" | "coral";
}) {
  if (tone === "coral") {
    return (
      <header className="public-header public-header-coral">
        <Link className="public-wordmark" href="/" aria-label="Formé, inicio">
          FORMÉ<span>®</span>
        </Link>
        <details className="public-menu">
          <summary>Menú</summary>
          <nav aria-label="Navegación secundaria">
            <Link href="/about">Qué es Formé</Link>
            <Link href="/pricing">Planes</Link>
          </nav>
        </details>
      </header>
    );
  }

  return (
    <header className={`public-header public-header-${tone}`}>
      <Link className="public-wordmark" href="/" aria-label="Formé, inicio">
        FORMÉ<span>®</span>
      </Link>
      <nav className="public-navigation" aria-label="Navegación principal">
        <Link href="/about">Qué es Formé</Link>
        <Link href="/closet">Closet</Link>
        <Link href="/pricing">Planes</Link>
      </nav>
      <Link className="public-entry" href="/closet">Abrir mi closet</Link>
    </header>
  );
}
