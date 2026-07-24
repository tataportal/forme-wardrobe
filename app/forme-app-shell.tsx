type ProductRoute = "closet" | "looks" | "asistente";

type FormeAppHeaderProps = {
  activeRoute: string;
  view: "wardrobe" | "studio";
  sessionStatus: "checking" | "guest" | "authenticated";
  demoMode: boolean;
  profileImage: string;
  profileImageClass: string;
  onNavigate: (route: ProductRoute | "perfil") => void;
  onOpenCanvas: () => void;
  onSignIn: () => void;
  onOpenPricing: () => void;
};

const primaryRoutes: Array<{ route: ProductRoute; label: string }> = [
  { route: "closet", label: "Closet" },
  { route: "looks", label: "Looks" },
  { route: "asistente", label: "Asistente" },
];

export function FormeAppHeader({
  activeRoute,
  view,
  sessionStatus,
  demoMode,
  profileImage,
  profileImageClass,
  onNavigate,
  onOpenCanvas,
  onSignIn,
  onOpenPricing,
}: FormeAppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <button className="wordmark" onClick={() => onNavigate("closet")} aria-label="Volver al closet">
          FORMÉ<span>®</span>
        </button>

        <nav className="zone-nav" aria-label="Secciones principales">
          {primaryRoutes.map(({ route, label }) => (
            <button
              key={route}
              className={view === "wardrobe" && activeRoute === route ? "active" : ""}
              onClick={() => onNavigate(route)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button className={view === "studio" ? "canvas-entry active" : "canvas-entry"} onClick={onOpenCanvas}>
            Canvas
          </button>
          {sessionStatus === "checking" ? (
            <span className="session-checking" aria-label="Revisando sesión" />
          ) : demoMode ? (
            <button className="google-login" aria-label="Entrar con Google" onClick={onSignIn}>
              Entrar
            </button>
          ) : (
            <div className="topbar-account">
              <button className="pricing-entry" type="button" onClick={onOpenPricing}>Planes</button>
              <button className="avatar" onClick={() => onNavigate("perfil")} aria-label="Abrir mi perfil">
                <img className={profileImageClass} src={profileImage} alt="" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function FormeMobileNav({
  activeRoute,
  view,
  onNavigate,
}: {
  activeRoute: string;
  view: "wardrobe" | "studio";
  onNavigate: (route: ProductRoute) => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Secciones principales">
      {primaryRoutes.map(({ route, label }) => (
        <button
          key={route}
          className={view === "wardrobe" && activeRoute === route ? "active" : ""}
          onClick={() => onNavigate(route)}
        >
          <span aria-hidden="true">{route === "closet" ? "01" : route === "looks" ? "02" : "03"}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
