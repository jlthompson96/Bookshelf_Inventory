"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Book } from "@/lib/notion";
import { genresIn, matchesFilters, sortBooks } from "@/lib/filters";
import { bookHref } from "@/lib/href";
import { booksOnShelf, shelfNumbers as shelvesIn, slotsFor } from "@/lib/shelf";
import { callNumber, cloth, height, weight } from "@/lib/spine";
import Toolbar from "./Toolbar";
import { filterQuery, useInventoryFilters } from "./useInventoryFilters";
import styles from "./Bookshelf.module.css";

const DEFAULT_SORT = { value: "shelf", label: "Shelf order" };

const label = (b: Book) =>
  `${b.t} by ${b.a}. Shelf ${b.sh}, position ${b.p}. ${b.s}.`;

export default function Bookshelf({ books }: { books: Book[] }) {
  const filters = useInventoryFilters(DEFAULT_SORT.value);
  const { sort } = filters;

  /* Hung on every card link so the shelf underneath keeps its filters, and Back
     returns to the view the reader actually had rather than a bare shelf. */
  const query = filterQuery(filters, DEFAULT_SORT.value);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  /* The edge fades only mean something when there is actually more shelf out
     of view, so they are gated on a measured overflow rather than assumed. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sort]);

  const genres = useMemo(() => genresIn(books), [books]);
  const shelfNumbers = useMemo(() => shelvesIn(books), [books]);

  const matches = useCallback((b: Book) => matchesFilters(b, filters), [filters]);

  const visible = useMemo(() => books.filter(matches), [books, matches]);
  const read = useMemo(() => books.filter((b) => b.s === "Read").length, [books]);

  /* Non-shelf orders break the physical-position metaphor, so they switch to an
     explicit catalog view rather than silently rearranging the shelves. */
  const catalog = useMemo(() => sortBooks(visible, sort), [visible, sort]);

  if (!books.length) {
    return (
      <main className={`${styles.page} ${styles.emptyState}`}>
        <p className="eyebrow">Empty stacks</p>
        <h1 className={styles.title}>Nothing on the shelf</h1>
        <p className={styles.lede}>
          Notion answered, but no rows came back carrying both a shelf number and a
          position.
        </p>
      </main>
    );
  }

  const stat = (value: number, name: string, live = false) => (
    <div key={name} className={`${styles.stat} ${live ? styles.statLive : ""}`}>
      <dt className={`eyebrow ${styles.statLabel}`}>{name}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  );

  const spine = (book: Book) => {
    const vars = {
      "--cloth": cloth(book),
      "--h": `${height(book)}px`,
      "--w": weight(book),
    } as React.CSSProperties;

    const inner = (
      <>
        <span className={styles.spineTitle}>{book.t}</span>
        <span className={styles.plate} aria-hidden="true">
          {callNumber(book)}
        </span>
      </>
    );

    /* Filtered-out spines become decorative. They previously stayed in the tab
       order at 0.14 opacity, so a keyboard user landed on targets they could
       not see. */
    if (!matches(book)) {
      return (
        <div
          key={book.u}
          className={styles.spine}
          style={vars}
          data-read={book.s === "Read"}
          data-dim="true"
          aria-hidden="true"
        >
          {inner}
        </div>
      );
    }

    return (
      <Link
        key={book.u}
        href={`${bookHref(book)}${query}`}
        className={styles.spine}
        style={vars}
        data-read={book.s === "Read"}
        aria-label={label(book)}
      >
        {inner}
      </Link>
    );
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>The shelf, as it stands</h1>
        <p className={styles.lede}>
          {sort === "shelf"
            ? "Every volume in its real position, left to right. Cloth spines are read, page blocks are waiting. The plate on each spine carries its shelf and position."
            : "The same inventory as a catalog, ordered off the shelf. Switch back to shelf order to see each volume in its real position."}
        </p>
      </header>

      <dl className={styles.stats}>
        {stat(books.length, "Volumes")}
        {stat(read, "Read")}
        {stat(books.length - read, "Waiting")}
        {stat(visible.length, "In view", true)}
      </dl>

      <Toolbar filters={filters} genres={genres} defaultSort={DEFAULT_SORT} />

      <p className={styles.status} role="status">
        {visible.length} of {books.length} volumes in view
        {sort !== "shelf" ? ", shown as a catalog" : ""}
      </p>

      {sort === "shelf" ? (
        <>
          <a className="skip-link" href="#past-shelves">
            Skip past the shelves
          </a>
          <div className={styles.scrollFrame} data-overflow={overflowing}>
            <div className={styles.scroller} ref={scrollerRef}>
              {shelfNumbers.map((n) => {
                const shelfBooks = booksOnShelf(books, n);
                const slots = slotsFor(books, n);
                return (
                  <section
                    key={n}
                    className={styles.shelf}
                    aria-labelledby={`shelf-${n}`}
                  >
                    <h2 id={`shelf-${n}`} className={styles.shelfTitle}>
                      Shelf {n}
                    </h2>
                    <p className={`eyebrow ${styles.shelfMeta}`}>
                      {shelfBooks.length} volumes &middot;{" "}
                      {shelfBooks.filter((b) => b.s === "Read").length} read
                    </p>
                    <div className={styles.row}>
                      {slots.map((slot) =>
                        slot.empty ? (
                          <div
                            key={`empty-${n}-${slot.p}`}
                            className={styles.empty}
                            aria-hidden="true"
                          />
                        ) : (
                          spine(slot)
                        )
                      )}
                    </div>
                    <div className={styles.board} />
                  </section>
                );
              })}
            </div>
          </div>
          <div id="past-shelves" tabIndex={-1} />
        </>
      ) : (
        <ul className={styles.catalog}>
          {catalog.map((book) => (
            <li key={book.u}>
              <Link
                href={`${bookHref(book)}${query}`}
                className={styles.catalogItem}
                style={{ "--cloth": cloth(book) } as React.CSSProperties}
                aria-label={label(book)}
              >
                <p className={styles.catalogTitle}>{book.t}</p>
                <p className={styles.catalogAuthor}>{book.a}</p>
                <p className={styles.catalogMeta}>
                  <span>{callNumber(book)}</span>
                  <span>{book.s}</span>
                  {book.rating ? <span>{"★".repeat(book.rating)}</span> : null}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
