import type { Metadata } from "next";
import "./globals.css";

const title = "FORME — Your wardrobe, re-seen";
const description = "Ghost your clothes, build better outfits and keep a visual archive of everything you own.";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title,
  description,
  icons: { icon: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`, shortcut: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg` },
  openGraph: { title, description, type: "website", images: [{ url: `${siteUrl}/og.png`, width: 1792, height: 896, alt: "FORME virtual wardrobe" }] },
  twitter: { card: "summary_large_image", title, description, images: [`${siteUrl}/og.png`] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
