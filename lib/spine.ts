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
   verified at or above 4.5:1 against the paper ground. */
const CLOTH: Record<string, string> = {
  Fantasy: "var(--cloth-fantasy)",
  "Sci-Fi": "var(--cloth-scifi)",
  "Classic Literature": "var(--cloth-classic)",
  "Historical Fiction": "var(--cloth-historical)",
  Mythology: "var(--cloth-mythology)",
  "Philosophical Fiction": "var(--cloth-philosophical)",
  "Gothic / Horror": "var(--cloth-gothic)",
  "Dystopian Fiction": "var(--cloth-dystopian)",
  "Mystery / Detective": "var(--cloth-mystery)",
  "Epic Poetry": "var(--cloth-poetry)",
  Adventure: "var(--cloth-adventure)",
};

const FALLBACK = "var(--cloth-fallback)";

export const clothFor = (genre: string) => CLOTH[genre] ?? FALLBACK;
export const cloth = (b: BookCore) => clothFor(b.g[0]);

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
