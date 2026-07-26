import Link from "next/link";

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
        <Link href="/closet">Closet</Link>
        <Link href="/canvas">Canvas</Link>
        <Link href="/asistente">Asistente</Link>
      </nav>
      <span className="public-header-balance" aria-hidden="true" />
    </header>
  );
}
