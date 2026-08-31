/**
 * Shelf geometry: which positions on a shelf are taken, and which are gaps.
 *
 * The shelf view walks these slots to draw empty blocks, the add form uses the
 * first gap as the suggested position, and the create endpoint uses the
 * occupant lookup to refuse a collision. One definition so the three cannot
 * disagree about where a book goes.
 */

import type { Book } from "./notion";

export type Slot = { empty: true; p: number } | (Book & { empty?: false });

export const shelfNumbers = (books: Book[]): number[] =>
  Array.from(new Set(books.map((b) => b.sh))).sort((a, b) => a - b);

export const booksOnShelf = (books: Book[], shelf: number): Book[] =>
  books.filter((b) => b.sh === shelf).sort((a, b) => a.p - b.p);

/** Every position from 1 to the furthest occupied one, gaps included. */
export function slotsFor(books: Book[], shelf: number): Slot[] {
  const on = booksOnShelf(books, shelf);
  if (!on.length) return [];

  const max = Math.max(...on.map((b) => b.p));
  const slots: Slot[] = [];
  for (let p = 1; p <= max; p++) {
    slots.push(on.find((b) => b.p === p) ?? { empty: true, p });
  }
  return slots;
}

export const occupantAt = (books: Book[], shelf: number, position: number): Book | undefined =>
  books.find((b) => b.sh === shelf && b.p === position);

/**
 * Where a new book goes: the first gap, so shelving fills holes before it grows
 * the shelf, and otherwise the end.
 */
export function nextFreePosition(books: Book[], shelf: number): number {
  const gap = slotsFor(books, shelf).find((s) => s.empty);
  if (gap) return gap.p;
  return booksOnShelf(books, shelf).length ? Math.max(...booksOnShelf(books, shelf).map((b) => b.p)) + 1 : 1;
}
