/**
 * Notion dates arrive as "YYYY-MM-DD".
 *
 * Passing that string to the Date constructor parses it as UTC midnight, which
 * renders as the previous day for anyone west of Greenwich — a book finished on
 * the 1st shows as the last day of the month before, and in the reading-year
 * page it lands in the wrong month entirely. So the parts are read directly and
 * a local date is constructed from them. Nothing here should ever call
 * `new Date(iso)` on a Notion date.
 */

/** The date parts, or null if the value is not a date Notion produced. */
export function parseNotionDate(iso: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

/** The year a book was finished, for grouping. */
export const yearOf = (iso: string): number | null => parseNotionDate(iso)?.y ?? null;

/** 1-12, for grouping into months. */
export const monthOf = (iso: string): number | null => parseNotionDate(iso)?.m ?? null;

export function formatFinished(iso: string): string {
  const parts = parseNotionDate(iso);
  if (!parts) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(parts.y, parts.m - 1, parts.d));
}
