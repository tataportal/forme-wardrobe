import { FormePublicHeader } from "../forme-public-header";
import Link from "next/link";
import { LegalLinks } from "../legal-page";
import { LEGAL_VERSION, legalReady } from "../../shared/legal";
export const metadata = { title: "Tu cuenta | Formé", robots: { index: false, follow: true } };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string; error?: string; ref?: string }> }) {
  const params = await searchParams;
  return <main className="legal-page forme-app public-app"><FormePublicHeader />
    <section className="legal-signin" aria-labelledby="signin-title">
      <h1 id="signin-title">Tu cuenta, tus prendas.</h1>
      <p>Guarda tu closet y tus looks. Recibes 10 créditos al crear tu cuenta y 5 más al completar el tutorial.</p>
      {!legalReady && <p className="legal-draft">Borrador. El registro legal estará disponible al confirmar los datos del responsable.</p>}
      {params.error && <p role="alert">Revisa y acepta ambas condiciones para continuar.</p>}
      <form action="/auth/google/start" method="post">
        <input type="hidden" name="version" value={LEGAL_VERSION} />
        <input type="hidden" name="return_to" value={typeof params.return_to === "string" ? params.return_to : "/closet"} />
        {typeof params.ref === "string" && <input type="hidden" name="ref" value={params.ref} />}
        <label className="legal-check"><input type="checkbox" name="terms" value="yes" required /><span>Acepto los <a href="/terminos" target="_blank" rel="noreferrer">Términos de uso</a>, incluidas las reglas sobre fotos y <a href="/terminos#usernames" target="_blank" rel="noreferrer">@usuarios</a>.</span></label>
        <label className="legal-check"><input type="checkbox" name="privacy" value="yes" required /><span>He leído la <a href="/privacidad" target="_blank" rel="noreferrer">Política de privacidad</a> y consiento el tratamiento de mis datos para mi cuenta y las funciones que solicite, incluido el procesamiento de fotos por proveedores fuera de Perú.</span></label>
        <button className="legal-continue" type="submit" disabled={!legalReady}>Aceptar y continuar</button>
      </form>
      <p className="legal-caption">Usamos Google para identificarte. Si ya tienes una sesión abierta, no necesitas volver a entrar. Esta aceptación no incluye publicidad.</p>
      <Link href="/closet">Seguir explorando sin cuenta</Link>
      <LegalLinks />
    </section>
  </main>;
}
