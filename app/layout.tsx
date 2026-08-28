import type { Metadata, Viewport } from "next";
import { Libre_Caslon_Display, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Libre_Caslon_Display({ subsets: ["latin"], weight: ["400"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Bookshelf",
  description: "Every volume in shelf order, drawn from the Notion Bookshelf Inventory.",
  openGraph: {
    title: "Bookshelf",
    description: "Every volume in shelf order, drawn from the Notion Bookshelf Inventory.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f0e6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
