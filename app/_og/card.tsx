/**
 * Shared furniture for the share images.
 *
 * These are rendered by satori, which is not a browser. Three things follow,
 * and each of them is a silent failure rather than an error:
 *
 *   - There is no block layout. Any element with more than one child needs an
 *     explicit `display: flex`, or its children stack on top of each other.
 *   - There is no cascade and no stylesheet, so every style is inline and every
 *     colour is a literal. A `var(--paper)` here paints nothing at all, which is
 *     why lib/spine.ts carries the cloth hex alongside the token name.
 *   - Fonts must be supplied as buffers, and satori cannot parse woff2 — which
 *     is exactly what fonts.googleapis.com serves by default. The two faces are
 *     vendored here as TTF rather than fetched at render time.
 *
 * The palette is duplicated from app/globals.css for the same reason as the
 * cloth: nothing can resolve a token out here.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export const SIZE = { width: 1200, height: 630 };

export const PAPER = "#f4f0e6";
export const PAPER_RAISED = "#fbf8f1";
export const INK = "#23201b";
export const INK_2 = "#5a5348";
export const INK_3 = "#6e6658";
export const RULE = "#d6cebc";
export const BRASS = "#7a5d28";
export const WALNUT = "#6b4f32";

/**
 * Loaded once per render. Both faces are needed: Caslon sets the title, Plex
 * Mono everything in small caps.
 *
 * Read off disk rather than through `fetch(new URL(..., import.meta.url))`,
 * which is the pattern the Next docs show and which fails here: the bundler
 * rewrites that URL to a relative `/_next/static/media/...` path, and `fetch`
 * has no origin to resolve it against while the image is being prerendered.
 * next.config.mjs traces these two files into the deployment so the path
 * resolves in a serverless function as well as in the build.
 */
export async function fonts() {
  const dir = path.join(process.cwd(), "app", "_og");
  const [caslon, mono] = await Promise.all([
    readFile(path.join(dir, "LibreCaslonDisplay-Regular.ttf")),
    readFile(path.join(dir, "IBMPlexMono-Medium.ttf")),
  ]);

  return [
    { name: "Caslon", data: caslon, weight: 400 as const, style: "normal" as const },
    { name: "Plex Mono", data: mono, weight: 500 as const, style: "normal" as const },
  ];
}

/* The paper grain that body::before draws in the app. An inline SVG data URI,
   because satori has no filters of its own. */
export const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")";

export const eyebrow = {
  fontFamily: "Plex Mono",
  fontSize: 22,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: INK_3,
};
