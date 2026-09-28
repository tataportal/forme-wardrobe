import { productFeatures } from "./product-features";
import { AccountCredits } from "./account-credits";

type ProductRoute = "closet" | "looks" | "asistente";
type PrimaryDestination = "closet" | "canvas" | "looks" | "asistente";

type FormeAppHeaderProps = {
  activeRoute: string;
  view: "wardrobe" | "studio";
  sessionStatus: "checking" | "guest" | "authenticated";
  demoMode: boolean;
  profileImage: string;
  profileImageClass: string;
  credits?: number;
  creditsUsed?: number;
  onTutorial: () => void;
  onNavigate: (route: ProductRoute | "perfil") => void;
  onOpenCanvas: () => void;
  onSignIn: () => void;
};

const primaryDestinations: Array<{ destination: PrimaryDestination; label: string }> = [
  { destination: "closet", label: "Mi closet" },
  { destination: "canvas", label: "Canvas" },
  { destination: "looks", label: "Looks" },
  ...(productFeatures.assistant ? [{ destination: "asistente" as const, label: "Asistente" }] : []),
];

export function FormeAppHeader({
  activeRoute,
  view,
  sessionStatus,
  demoMode,
  profileImage,
  profileImageClass,
  credits,
  creditsUsed,
  onTutorial,
  onNavigate,
  onOpenCanvas,
  onSignIn,
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
              aria-current={(destination === "canvas" ? view === "studio" : view === "wardrobe" && activeRoute === destination) ? "page" : undefined}
              className={
                destination === "canvas"
                  ? view === "studio" ? "active" : ""
                  : view === "wardrobe" && (
                    destination === "closet"
                      ? activeRoute === "closet"
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
              <button type="button" className="tutorial-trigger" onClick={onTutorial} aria-label="Ver tutorial animado">?</button>
              <AccountCredits credits={credits} creditsUsed={creditsUsed} onTutorial={onTutorial} />
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
      {primaryDestinations.map(({ destination, label }) => (
        <button
          key={destination}
              aria-current={(destination === "canvas" ? view === "studio" : view === "wardrobe" && activeRoute === destination) ? "page" : undefined}
          className={
            destination === "canvas"
              ? view === "studio" ? "active" : ""
              : view === "wardrobe" && (
                destination === "closet"
                  ? activeRoute === "closet"
                  : activeRoute === destination
              ) ? "active" : ""
          }
          onClick={() => destination === "canvas" ? onOpenCanvas() : onNavigate(destination)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
