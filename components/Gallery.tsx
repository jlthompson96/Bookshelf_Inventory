"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ChestBook } from "@/lib/notion";
import type { Cover } from "@/lib/bookinfo";
import { genresIn, matchesFilters, sortBooks } from "@/lib/filters";
import { bookHref } from "@/lib/href";
import { callNumber, cloth } from "@/lib/spine";
import Toolbar from "./Toolbar";
import { filterQuery, useInventoryFilters } from "./useInventoryFilters";
import styles from "./Gallery.module.css";

/**
 * The whole collection as jackets rather than spines.
 *
 * Covers are not in Notion, so every tile is a catalogue lookup — which is why
 * this is the one view with a batched endpoint behind it. Tiles ask only once
 * they are near the viewport, in screenfuls, and what comes back is kept for the
 * session: scrolling back up the grid costs nothing.
 */

const DEFAULT_SORT = { value: "inventory", label: "Inventory order" };

const SOURCES = [
  { value: "both", label: "Both" },
  { value: "shelf", label: "Shelf" },
  { value: "chest", label: "Chest" },
] as const;

/* Kept across mounts, so leaving the gallery for a card and coming back does
   not re-request the screenful already on show. */
const covers = new Map<string, Cover | null>();

/** The endpoint's own cap. Asking for more is a 400 by design. */
const BATCH = 24;

type Tagged = ChestBook & { from: "shelf" | "chest" };

export default function Gallery({
  shelf,
  chest,
}: {
  shelf: ChestBook[];
  chest: ChestBook[];
}) {
  const searchParams = useSearchParams();
  const [source, setSource] = useState(() => searchParams.get("source") ?? "both");

  const filters = useInventoryFilters(DEFAULT_SORT.value, {
    source: source === "both" ? undefined : source,
  });
  const { sort } = filters;
  const query = filterQuery(filters, DEFAULT_SORT.value, {
    source: source === "both" ? undefined : source,
  });

  /* Re-rendered rather than mutated, so a cover arriving repaints its tile. */
  const [loaded, setLoaded] = useState(0);

  const books = useMemo<Tagged[]>(
    () => [
      ...shelf.map((b) => ({ ...b, from: "shelf" as const })),
      ...chest.map((b) => ({ ...b, from: "chest" as const })),
    ],
    [shelf, chest]
  );

  const genres = useMemo(() => genresIn(books), [books]);

  const visible = useMemo(() => {
    const inSource = books.filter((b) => source === "both" || b.from === source);
    return sortBooks(
      inSource.filter((b) => matchesFilters(b, filters)),
      sort
    );
  }, [books, source, filters, sort]);

  /* --- cover loading ----------------------------------------------------
     One observer for the whole grid. Ids seen near the viewport pile up in a
     pending set which is drained a screenful at a time, rather than one request
     per tile: eighty tiles scrolling past would otherwise be eighty requests,
     each of which is two catalogue lookups on the server. */
  const pending = useRef(new Set<string>());
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const drain = useCallback(async () => {
    if (inFlight.current) return;
    const batch = [...pending.current].filter((id) => !covers.has(id)).slice(0, BATCH);
    if (!batch.length) return;

    inFlight.current = true;
    batch.forEach((id) => pending.current.delete(id));

    try {
      const res = await fetch(`/api/books/covers?ids=${batch.join(",")}`);
      const data = res.ok ? await res.json() : null;
      for (const id of batch) covers.set(id, data?.covers?.[id] ?? null);
    } catch {
      /* A failed batch is recorded as a miss rather than retried. The tiles
         fall back to their cloth bindings, which is what a book with no jacket
         looks like anyway — and a retry loop against a rate-limited catalogue
         only makes the next batch worse. */
      for (const id of batch) covers.set(id, null);
    } finally {
      inFlight.current = false;
      setLoaded((n) => n + 1);
      if (pending.current.size) void drain();
    }
  }, []);

  const observer = useRef<IntersectionObserver | null>(null);

  /**
   * Built on first use rather than in an effect. React runs ref callbacks
   * before effects, so an observer created in one does not exist yet when the
   * first screenful of tiles asks to be watched — they are silently never
   * observed, and no cover ever loads.
   */
  const getObserver = useCallback(() => {
    if (observer.current) return observer.current;
    /* Guards the server render, where there is no IntersectionObserver and the
       ref callback never runs anyway. */
    if (typeof IntersectionObserver === "undefined") return null;

    observer.current = new IntersectionObserver(
      (entries) => {
        let added = false;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = (entry.target as HTMLElement).dataset.book;
          if (!id || covers.has(id)) continue;
          pending.current.add(id);
          added = true;
          observer.current?.unobserve(entry.target);
        }
        if (!added) return;
        /* Debounced so a fast scroll through six screenfuls collects them into
           whole batches instead of firing a request per screen. */
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void drain(), 120);
      },
      /* Started before a tile is on screen, so the jacket is usually there by
         the time it is scrolled to. */
      { rootMargin: "400px 0px" }
    );
    return observer.current;
  }, [drain]);

  useEffect(
    () => () => {
      observer.current?.disconnect();
      observer.current = null;
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const observe = useCallback(
    (el: HTMLElement | null) => {
      if (el) getObserver()?.observe(el);
    },
    [getObserver]
  );

  if (!books.length) {
    return (
      <main className={`${styles.page} ${styles.emptyState}`}>
        <p className="eyebrow">Empty stacks</p>
        <h1 className={styles.title}>Nothing to show</h1>
        <p className={styles.lede}>
          Neither the shelf nor the chest came back with a titled row.
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>The collection, in covers</h1>
        <p className={styles.lede}>
          Every volume on the shelf and in the chest, drawn as its jacket. Covers come
          from Open Library and Google Books as each tile is scrolled to; a book neither
          catalogue knows keeps its cloth binding.
        </p>
      </header>

      <Toolbar filters={filters} genres={genres} defaultSort={DEFAULT_SORT}>
        <div className={styles.group} role="radiogroup" aria-label="Filter by location">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={source === s.value}
              className={styles.chip}
              onClick={() => setSource(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Toolbar>

      <p className={styles.status} role="status">
        {visible.length} of {books.length} volumes in view
      </p>

      <ul className={styles.grid}>
        {visible.map((book) => {
          const found = covers.get(book.id);
          const plate = callNumber(book);
          return (
            <li key={book.id}>
              <Link
                href={`${bookHref(book)}${query}`}
                className={styles.tile}
                style={{ "--cloth": cloth(book) } as React.CSSProperties}
                aria-label={`${book.t} by ${book.a}. ${book.s}.`}
              >
                <span className={styles.jacket} data-book={book.id} ref={observe}>
                  {found?.cover ? (
                    <img
                      className={styles.cover}
                      src={found.cover}
                      alt=""
                      loading="lazy"
                      /* A cover id can outlive the image behind it; dropping it
                         falls the tile back to its cloth binding rather than
                         leaving a broken image in the grid. */
                      onError={() => {
                        covers.set(book.id, { ...found, cover: undefined });
                        setLoaded((n) => n + 1);
                      }}
                    />
                  ) : (
                    /* The no-jacket case is a bound book, not a hole: the title
                       set in Caslon on the book's own cloth. */
                    <span className={styles.binding} aria-hidden="true">
                      <span className={styles.bindingTitle}>{book.t}</span>
                      {plate ? <span className={styles.plate}>{plate}</span> : null}
                    </span>
                  )}
                </span>
                <span className={styles.caption}>
                  <span className={styles.tileTitle}>{book.t}</span>
                  <span className={styles.tileAuthor}>{book.a}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
