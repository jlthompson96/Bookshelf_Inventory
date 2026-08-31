/**
 * Where a book lives on this site.
 *
 * The shape is Notion's own — a readable slug with the page id on the end —
 * because the slug is decoration and the id is the address. A retitled book
 * changes its slug, and every link ever shared for it still resolves.
 */

import type { BookCore } from "./notion";

export const slugify = (title: string): string =>
  title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    /* slice() can leave a trailing hyphen mid-word, which reads as a typo. */
    .replace(/-+$/, "");

export const bookHref = (b: BookCore): string => {
  const slug = slugify(b.t);
  return `/book/${slug ? `${slug}-` : ""}${b.id}`;
};

/**
 * The inverse: the id out of a route parameter. Anchored to the end so a title
 * that happens to contain a run of hex digits cannot be mistaken for one, and
 * tolerant of a bare id so a hand-typed URL still works.
 */
export const idFromParam = (param: string): string | null =>
  param.toLowerCase().match(/([0-9a-f]{32})$/)?.[1] ?? null;
