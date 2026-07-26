type ProductRoute = "closet" | "looks" | "asistente";
type PrimaryDestination = "closet" | "canvas" | "asistente";

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

const primaryDestinations: Array<{ destination: PrimaryDestination; label: string }> = [
  { destination: "closet", label: "Closet" },
  { destination: "canvas", label: "Canvas" },
  { destination: "asistente", label: "Asistente" },
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
          {primaryDestinations.map(({ destination, label }) => (
            <button
              key={destination}
              className={
                destination === "canvas"
                  ? view === "studio" ? "active" : ""
                  : view === "wardrobe" && (
                    destination === "closet"
                      ? activeRoute === "closet" || activeRoute === "looks"
                      : activeRoute === destination
                  ) ? "active" : ""
              }
              onClick={() => destination === "canvas" ? onOpenCanvas() : onNavigate(destination)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
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
  onOpenCanvas,
}: {
  activeRoute: string;
  view: "wardrobe" | "studio";
  onNavigate: (route: ProductRoute) => void;
  onOpenCanvas: () => void;
}) {
  return (
    <nav className="mobile-nav" aria-label="Secciones principales">
      {primaryDestinations.map(({ destination, label }, index) => (
        <button
          key={destination}
          className={
            destination === "canvas"
              ? view === "studio" ? "active" : ""
              : view === "wardrobe" && (
                destination === "closet"
                  ? activeRoute === "closet" || activeRoute === "looks"
                  : activeRoute === destination
              ) ? "active" : ""
          }
          onClick={() => destination === "canvas" ? onOpenCanvas() : onNavigate(destination)}
        >
          <span aria-hidden="true">0{index + 1}</span>
          {label}
        </button>
      ))}
    </nav>
  );
}
