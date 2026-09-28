import type { Metadata } from "next";
import "./globals.css";
import "./forme-system.css";
import "./forme-pilot.css";
import "./legal.css";

const title = "FORMÉ | Tu ropa, leída de nuevo";
const description = "Tu closet digital. Añade tus prendas, combínalas y guarda tus looks.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://forme.gallery";
const socialImage = `${siteUrl}/forme-social-instagram-v1.gif`;

export const metadata: Metadata = {
  title,
  description,
  icons: {
    icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg?v=forme-red-1`,
    shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg?v=forme-red-1`,
    apple: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png?v=forme-red-1`,
  },
  openGraph: { title, description, type: "website", siteName: "Formé", url: siteUrl, images: [{ url: socialImage, width: 1200, height: 630, alt: "Formé®" }] },
  twitter: { card: "summary_large_image", title, description, images: [socialImage] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
