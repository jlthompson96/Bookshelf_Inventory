/**
 * What the inventory adds up to.
 *
 * Two different questions live here. The collection is what is owned, and every
 * row answers it. The reading year is what was finished and when, and it depends
 * on `Date Finished` — an optional property that a database need not define and
 * that this one currently does not. So every reading figure is reported next to
 * its coverage: how many of the books it could have counted actually carry the
 * date. A reading year that quietly says "3" when the truth is "3 recorded out
 * of 38 read" is worse than one that says nothing.
 */

import { monthOf, yearOf } from "./dates";
import type { ChestBook } from "./notion";

export type Tally = { name: string; count: number };

const descending = (a: Tally, b: Tally) => b.count - a.count || a.name.localeCompare(b.name);

export type Collection = {
  total: number;
  read: number;
  reading: number;
  unread: number;
  authors: number;
  subjects: Tally[];
  shelves: Tally[];
  /** How many rows carry each optional property, for the honesty line. */
  has: { finished: number; pages: number; rating: number };
};

export function collection(books: ChestBook[]): Collection {
  const count = (list: string[]): Tally[] => {
    const map = new Map<string, number>();
    for (const name of list) map.set(name, (map.get(name) ?? 0) + 1);
    return [...map].map(([name, count]) => ({ name, count })).sort(descending);
  };

  return {
    total: books.length,
    read: books.filter((b) => b.s === "Read").length,
    reading: books.filter((b) => b.s === "Reading").length,
    unread: books.filter((b) => b.s === "Unread").length,
    authors: new Set(books.map((b) => b.a.trim().toLowerCase()).filter(Boolean)).size,
    subjects: count(books.flatMap((b) => b.g)),
    shelves: count(books.filter((b) => b.sh != null).map((b) => String(b.sh))).sort(
      (a, b) => Number(a.name) - Number(b.name)
    ),
    has: {
      finished: books.filter((b) => b.finished).length,
      pages: books.filter((b) => b.pages).length,
      rating: books.filter((b) => b.rating).length,
    },
  };
}

/** Every year the inventory has a finish date in, newest first. */
export function yearsWithFinishes(books: ChestBook[]): number[] {
  const years = new Set<number>();
  for (const b of books) {
    const y = b.finished ? yearOf(b.finished) : null;
    if (y) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type ReadingYear = {
  year: number;
  books: ChestBook[];
  /** 12 entries, January first. */
  byMonth: number[];
  busiest: { month: string; count: number } | null;
  subjects: Tally[];
  authors: number;
  pages: number;
  /** Null when nothing that year carries a page count. */
  averageLength: number | null;
  longest: ChestBook | null;
  rating: number | null;
  ratings: Tally[];
  fromShelf: number;
  fromChest: number;
  /**
   * What the figures above are actually based on. `dated` of `read` is the one
   * that matters: the rest of the page is only as complete as that ratio.
   */
  coverage: {
    dated: number;
    read: number;
    withPages: number;
    withRating: number;
  };
};

export function readingYear(
  shelf: ChestBook[],
  chest: ChestBook[],
  year: number
): ReadingYear {
  const all = [...shelf, ...chest];
  const inYear = all.filter((b) => b.finished && yearOf(b.finished) === year);

  const byMonth = Array<number>(12).fill(0);
  for (const b of inYear) {
    const m = b.finished ? monthOf(b.finished) : null;
    if (m) byMonth[m - 1]++;
  }

  const peak = Math.max(0, ...byMonth);
  const busiest =
    peak > 0 ? { month: MONTHS[byMonth.indexOf(peak)], count: peak } : null;

  const subjectCount = new Map<string, number>();
  for (const b of inYear) for (const g of b.g) subjectCount.set(g, (subjectCount.get(g) ?? 0) + 1);

  const ratingCount = new Map<string, number>();
  for (const b of inYear) if (b.rating) ratingCount.set(String(b.rating), (ratingCount.get(String(b.rating)) ?? 0) + 1);

  const paged = inYear.filter((b) => b.pages);
  const rated = inYear.filter((b) => b.rating);
  const pages = paged.reduce((n, b) => n + (b.pages ?? 0), 0);

  /* Sorted newest first, so the year reads as a diary rather than a database
     dump. Ties inside a day fall back to the title for a stable order. */
  const ordered = [...inYear].sort(
    (a, b) => (b.finished ?? "").localeCompare(a.finished ?? "") || a.t.localeCompare(b.t)
  );

  const shelfIds = new Set(shelf.map((b) => b.id));

  return {
    year,
    books: ordered,
    byMonth,
    busiest,
    subjects: [...subjectCount].map(([name, count]) => ({ name, count })).sort(descending),
    authors: new Set(inYear.map((b) => b.a.trim().toLowerCase()).filter(Boolean)).size,
    pages,
    averageLength: paged.length ? Math.round(pages / paged.length) : null,
    longest: paged.length
      ? paged.reduce((m, b) => ((b.pages ?? 0) > (m.pages ?? 0) ? b : m))
      : null,
    rating: rated.length
      ? Math.round((rated.reduce((n, b) => n + (b.rating ?? 0), 0) / rated.length) * 10) / 10
      : null,
    ratings: [...ratingCount]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => Number(b.name) - Number(a.name)),
    fromShelf: inYear.filter((b) => shelfIds.has(b.id)).length,
    fromChest: inYear.filter((b) => !shelfIds.has(b.id)).length,
    coverage: {
      dated: inYear.length,
      read: all.filter((b) => b.s === "Read").length,
      withPages: paged.length,
      withRating: rated.length,
    },
  };
}
