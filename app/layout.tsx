import type { Metadata } from "next";
import "./globals.css";

const title = "FORMÉ | Tu ropa, leída de nuevo";
const description = "Digitaliza lo que tienes, crea looks y descubre el sistema que ya existe en tu forma de vestir.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://forme.gallery";

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`, shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg` },
  openGraph: { title, description, type: "website", images: [{ url: `${siteUrl}/og.png`, width: 1774, height: 887, alt: "Formé. Tu ropa ya sabe quién eres." }] },
  twitter: { card: "summary_large_image", title, description, images: [`${siteUrl}/og.png`] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
