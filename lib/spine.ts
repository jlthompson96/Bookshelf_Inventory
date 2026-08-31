/**
 * How a volume is drawn: its cloth colour, its proportions, and its call
 * number. Shared by the shelf and the chest so the same book cannot be a
 * different colour or a different thickness depending on which page it is on.
 *
 * The two views read the proportions along different axes — a spine standing on
 * a shelf is tall and thin, a book lying flat in a pile is wide and shallow —
 * so weight and height are returned as bare numbers and each view decides which
 * axis they land on.
 */

import type { BookCore } from "./notion";

/* Cloth colours resolve to tokens rather than literals, so the palette lives
   in one file. Each is a bookbinding tone rather than a UI hue, and each is
   verified at or above 4.5:1 against the paper ground.

   The hex is carried alongside the token name because the share images are
   rendered by satori, which paints outside the DOM and so never resolves a CSS
   custom property — a `var()` there comes out transparent, and satori has no
   theme to render dark anyway. These are the light values specifically; they
   must stay in step with the light --cloth-* tokens in app/globals.css (the
   dark ones are a separate, lighter set that only clothFor's var() ever
   touches). Nothing enforces that agreement but this comment. */
const CLOTH: Record<string, { token: string; hex: string }> = {
  Fantasy: { token: "--cloth-fantasy", hex: "#8a5a24" },
  "Sci-Fi": { token: "--cloth-scifi", hex: "#2a5f8f" },
  "Classic Literature": { token: "--cloth-classic", hex: "#5c594e" },
  "Historical Fiction": { token: "--cloth-historical", hex: "#9a3f63" },
  Mythology: { token: "--cloth-mythology", hex: "#7a6410" },
  "Philosophical Fiction": { token: "--cloth-philosophical", hex: "#376b57" },
  "Gothic / Horror": { token: "--cloth-gothic", hex: "#5a468a" },
  "Dystopian Fiction": { token: "--cloth-dystopian", hex: "#6e3f94" },
  "Mystery / Detective": { token: "--cloth-mystery", hex: "#2f6b4c" },
  "Epic Poetry": { token: "--cloth-poetry", hex: "#a05a1e" },
  Adventure: { token: "--cloth-adventure", hex: "#a33520" },
};

const FALLBACK = { token: "--cloth-fallback", hex: "#5c594e" };

export const clothFor = (genre: string) => `var(${(CLOTH[genre] ?? FALLBACK).token})`;
export const cloth = (b: BookCore) => clothFor(b.g[0]);

/** The same colour as a literal, for the share images. See the note above. */
export const clothHexFor = (genre: string) => (CLOTH[genre] ?? FALLBACK).hex;
export const clothHex = (b: BookCore) => clothHexFor(b.g[0]);

/**
 * Whether a genre has its own cloth colour, or would fall back to
 * --cloth-fallback — the same grey Classic Literature already uses, so a
 * fallen-back genre is not visually distinguishable as one. The shelf doctor
 * is the only caller; nothing here needs to know why a genre is unmapped, only
 * whether it is.
 */
export const isKnownGenre = (genre: string): boolean => genre in CLOTH;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Thickness and page-block depth stand in for real proportions until page
   counts exist. Add a Pages number property in Notion and both become
   proportional. Deterministic either way, so the server and client agree. */
export function weight(b: BookCore) {
  if (b.pages) return Math.max(0.55, Math.min(2.2, b.pages / 320));
  return 0.8 + (hash(b.t) % 45) / 100;
}

export function height(b: BookCore) {
  if (b.pages) return 140 + Math.min(60, Math.round(b.pages / 12));
  return 140 + (hash(b.a + b.t) % 58);
}

/**
 * The pasted label: group and position. Null for a chest book that has not been
 * assigned a pile yet, so the plate can be left off rather than printed blank.
 */
export function callNumber(b: BookCore & { sh?: number | null; p?: number | null }): string | null {
  if (b.sh == null || b.p == null) return null;
  return `${b.sh}·${String(b.p).padStart(2, "0")}`;
}
