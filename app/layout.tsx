import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Libre_Caslon_Display, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { writesEnabled } from "@/lib/auth";
import { siteUrl } from "@/lib/site";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

/* Runs before hydration (strategy="beforeInteractive"), so the right theme is
   on <html> for the very first paint. Without this the page always paints the
   light ground first and repaints dark a moment later, because the CSS that
   decides the System state is prefers-color-scheme, but an explicit Light/Dark
   choice lives in localStorage, which only JS can read. Self-contained rather
   than importing lib/theme.ts: nothing has loaded yet for it to import into.
   THEME_KEY must name the same key as that module — see its comment. */
const THEME_BOOTSTRAP = `
(function () {
  try {
    var v = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    if (v === "light" || v === "dark") {
      document.documentElement.setAttribute("data-theme", v);
    }
  } catch (e) {}
})();
`;

const display = Libre_Caslon_Display({ subsets: ["latin"], weight: ["400"], variable: "--font-display", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  /* Every opengraph-image in the app resolves against this. See lib/site.ts. */
  metadataBase: new URL(siteUrl()),
  title: { default: "Bookshelf", template: "%s · Bookshelf" },
  description: "Every volume in shelf order, drawn from the Notion Bookshelf Inventory.",
  openGraph: {
    title: "Bookshelf",
    description: "Every volume in shelf order, drawn from the Notion Bookshelf Inventory.",
    type: "website",
  },
};

export const viewport: Viewport = {
  /* Two entries rather than one: the browser picks whichever media query
     matches, so this tracks the OS automatically for the System theme. An
     explicit Light/Dark choice that disagrees with the OS is a known gap —
     the toggle changes the page, not this static tag — and not worth the
     complexity of rewriting a meta tag on every toggle for a chrome tint. */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f0e6" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1713" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        <Nav canWrite={writesEnabled()} />
        {children}
      </body>
    </html>
  );
}
