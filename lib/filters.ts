/**
 * What the toolbar does to a list of books.
 *
 * The shelf, the chest and the gallery all offer the same search, status,
 * subject and sort controls, and had all grown their own copy of the logic. One
 * definition so the three cannot disagree about what "Highest rated" means, or
 * about whether a search matches the author as well as the title.
 *
 * Typed on ChestBook throughout: its sh and p are nullable, so a shelved Book
 * satisfies it and one set of functions serves every view.
 */

import type { ChestBook } from "./notion";

export type Filters = {
  q: string;
  status: string;
  genre: string;
  sort: string;
};

/** The sort orders every view offers, beyond its own positional default. */
export const COMMON_SORTS = [
  { value: "title", label: "Title, A to Z" },
  { value: "author", label: "Author, A to Z" },
  { value: "finished", label: "Recently finished" },
  { value: "rating", label: "Highest rated" },
] as const;

export const STATUSES = ["All", "Read", "Reading", "Unread"] as const;

/** The subjects actually present, so a view never offers a filter that matches nothing. */
export const genresIn = (books: ChestBook[]): string[] => {
  const set = new Set<string>();
  books.forEach((b) => b.g.forEach((g) => set.add(g)));
  return ["All", ...Array.from(set).sort()];
};

export function matchesFilters(b: ChestBook, f: Filters): boolean {
  const needle = f.q.trim().toLowerCase();
  return (
    (f.status === "All" || b.s === f.status) &&
    (f.genre === "All" || b.g.includes(f.genre)) &&
    (!needle || b.t.toLowerCase().includes(needle) || b.a.toLowerCase().includes(needle))
  );
}

/**
 * Sorts a copy. An unrecognised sort — including each view's own positional
 * default, which is the caller's business rather than this module's — returns
 * the list in the order it arrived, which is already group-then-position from
 * getBooks and getChestBooks.
 */
export function sortBooks<T extends ChestBook>(books: T[], sort: string): T[] {
  const list = [...books];
  switch (sort) {
    case "title":
      return list.sort((a, b) => a.t.localeCompare(b.t));
    case "author":
      return list.sort((a, b) => a.a.localeCompare(b.a) || a.t.localeCompare(b.t));
    case "finished":
      return list.sort((a, b) => (b.finished ?? "").localeCompare(a.finished ?? ""));
    case "rating":
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.t.localeCompare(b.t));
    default:
      return list;
  }
}
