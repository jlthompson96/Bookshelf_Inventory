"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Filters } from "@/lib/filters";

/**
 * Filter state, mirrored into the URL so a view can be shared, bookmarked, and
 * undone with the Back button. Debounced so typing does not push a history
 * entry per keystroke.
 *
 * `defaultSort` is the view's own positional order — "shelf" on the shelf,
 * "pile" in the chest — which is omitted from the URL because it is what an
 * unadorned link already means.
 */
export type InventoryFilters = Filters & {
  setQ: (v: string) => void;
  setStatus: (v: string) => void;
  setGenre: (v: string) => void;
  setSort: (v: string) => void;
};

/**
 * `extra` is for a param a single view owns — the gallery's shelf/chest source.
 * It has to pass through here rather than being mirrored separately, because
 * this effect rewrites the whole query string and would otherwise drop it on
 * the next keystroke. An undefined value is omitted, which is how a view says
 * "this one is at its default".
 */
export function useInventoryFilters(
  defaultSort: string,
  extra: Record<string, string | undefined> = {}
): InventoryFilters {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "All");
  const [genre, setGenre] = useState(() => searchParams.get("genre") ?? "All");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? defaultSort);

  /* The path this view owns, captured once. It cannot be read at write time:
     opening a card pushes /book/<id> as an intercepted route, so the shelf stays
     mounted underneath while the live pathname is the modal's. Writing that back
     would rewrite the card's URL — and clearing the last filter would strand the
     reader on /book/<id> with the shelf's params gone. */
  const owner = useRef(pathname);

  const firstRender = useRef(true);

  /* Read inside the effect, but not a dependency of it: the identity of a
     literal object changes every render, which would restart the debounce on
     every keystroke and never let it fire. */
  const extraRef = useRef(extra);
  extraRef.current = extra;

  /* A stable stand-in for `extra` in the dependency list, so changing the
     source filter still triggers the mirror. */
  const extraKey = JSON.stringify(extra);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status !== "All") params.set("status", status);
      if (genre !== "All") params.set("genre", genre);
      if (sort !== defaultSort) params.set("sort", sort);
      for (const [k, v] of Object.entries(extraRef.current)) if (v) params.set(k, v);
      const query = params.toString();
      router.replace(query ? `${owner.current}?${query}` : owner.current, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [q, status, genre, sort, defaultSort, router, extraKey]);

  return { q, status, genre, sort, setQ, setStatus, setGenre, setSort };
}

/**
 * The query string to hang on a book link, so the view underneath an opened
 * card keeps its filters and Back restores them.
 */
export function filterQuery(
  f: Filters,
  defaultSort: string,
  extra: Record<string, string | undefined> = {}
): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.status !== "All") params.set("status", f.status);
  if (f.genre !== "All") params.set("genre", f.genre);
  if (f.sort !== defaultSort) params.set("sort", f.sort);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  const query = params.toString();
  return query ? `?${query}` : "";
}
