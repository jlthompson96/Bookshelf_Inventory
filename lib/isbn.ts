/**
 * Its own module because the scanner runs in the browser and needs to validate
 * every frame it reads. Importing this from lib/bookinfo would pull the whole
 * catalogue-lookup layer — and its API-key handling — into the client bundle to
 * get at one pure function.
 */

/**
 * Strips separators and validates the check digit, returning the canonical
 * digits or null. A barcode misread is common enough — a scuffed cover, a bad
 * angle — that catching it here saves a round trip and, more usefully, tells
 * the scanner to keep looking rather than reporting the book as unknown.
 */
export function normalizeIsbn(raw: string): string | null {
  const s = raw.replace(/[^0-9Xx]/g, "").toUpperCase();

  /* The 978/979 prefix is doing real work, not decoration. An ISBN-13 is an
     EAN-13 and shares its check digit algorithm exactly, so a tin of soup
     passes the arithmetic — and the scanner reads whatever is in frame. Without
     the prefix test, a barcode on the wrong side of the book stops the scan and
     is then reported as a book the catalogues do not know. */
  if (s.length === 13) {
    if (!/^97[89]\d{10}$/.test(s)) return null;
    const sum = s.split("").reduce((n, d, i) => n + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : null;
  }

  if (s.length === 10) {
    if (!/^\d{9}[\dX]$/.test(s)) return null;
    const sum = s.split("").reduce((n, c, i) => n + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }

  return null;
}
