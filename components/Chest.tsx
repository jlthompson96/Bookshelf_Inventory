"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { isPlaced, type ChestBook } from "@/lib/notion";
import { genresIn, matchesFilters, sortBooks } from "@/lib/filters";
import { bookHref } from "@/lib/href";
import { booksOnShelf, shelfNumbers as pilesIn, slotsFor } from "@/lib/shelf";
import { callNumber, cloth, height, weight } from "@/lib/spine";
import Toolbar from "./Toolbar";
import { filterQuery, useInventoryFilters } from "./useInventoryFilters";
import styles from "./Chest.module.css";

const DEFAULT_SORT = { value: "pile", label: "Pile order" };

const label = (b: ChestBook) =>
  b.sh != null && b.p != null
    ? `${b.t} by ${b.a}. Pile ${b.sh}, position ${b.p} from the bottom. ${b.s}.`
    : `${b.t} by ${b.a}. Not yet placed in a pile. ${b.s}.`;

export default function Chest({ books }: { books: ChestBook[] }) {
  const filters = useInventoryFilters(DEFAULT_SORT.value);
  const { sort } = filters;

  /* Hung on every card link so the chest underneath keeps its filters, and Back
     returns to the view the reader actually had. */
  const query = filterQuery(filters, DEFAULT_SORT.value);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  /* The edge fades only mean something when there is actually more chest out of
     view, so they are gated on a measured overflow rather than assumed. */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sort]);

  /* A pile is structurally a shelf once the unplaced books are set aside, so
     the shelf geometry is reused rather than restated. */
  const placed = useMemo(() => books.filter(isPlaced), [books]);
  const loose = useMemo(() => books.filter((b) => !isPlaced(b)), [books]);
  const piles = useMemo(() => pilesIn(placed), [placed]);

  const genres = useMemo(() => genresIn(books), [books]);

  const matches = useCallback((b: ChestBook) => matchesFilters(b, filters), [filters]);

  const visible = useMemo(() => books.filter(matches), [books, matches]);

  /* Non-pile orders break the physical-position metaphor, so they switch to an
     explicit catalog view rather than silently restacking the chest. */
  const catalog = useMemo(() => sortBooks(visible, sort), [visible, sort]);

  if (!books.length) {
    return (
      <main className={`${styles.page} ${styles.emptyState}`}>
        <p className="eyebrow">Empty chest</p>
        <h1 className={styles.title}>Nothing in the chest</h1>
        <p className={styles.lede}>
          Notion answered, but the Storage Chest Books database came back without a
          single titled row.
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

  /* One book lying flat. The shelf's thickness becomes this slab's height and
     its depth becomes the width — same numbers, rotated. */
  const slab = (book: ChestBook) => {
    const vars = {
      "--cloth": cloth(book),
      "--w": weight(book),
      "--d": height(book),
    } as React.CSSProperties;

    const plate = callNumber(book);
    const inner = (
      <>
        <span className={styles.slabTitle}>{book.t}</span>
        {plate ? (
          <span className={styles.plate} aria-hidden="true">
            {plate}
          </span>
        ) : null}
      </>
    );

    /* Filtered-out slabs become decorative rather than staying as dimmed
       buttons, so a keyboard user never lands on a target they cannot see. */
    if (!matches(book)) {
      return (
        <div
          key={book.u}
          className={styles.slab}
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
        className={styles.slab}
        style={vars}
        data-read={book.s === "Read"}
        aria-label={label(book)}
      >
        {inner}
      </Link>
    );
  };

  const card = (book: ChestBook) => (
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
          {callNumber(book) ? <span>{callNumber(book)}</span> : null}
          <span>{book.s}</span>
          {book.rating ? <span>{"★".repeat(book.rating)}</span> : null}
        </p>
      </Link>
    </li>
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Storage chest</p>
        <h1 className={styles.title}>The overflow, in piles</h1>
        <p className={styles.lede}>
          {sort === "pile"
            ? "Books stacked flat in the chest, drawn bottom to top the way they actually sit. The plate on each spine carries its pile and position."
            : "The same chest as a catalog, ordered out of the piles. Switch back to pile order to see each volume where it actually lies."}
        </p>
      </header>

      <dl className={styles.stats}>
        {stat(books.length, "Volumes")}
        {stat(piles.length, "Piles")}
        {stat(loose.length, "Unplaced")}
        {stat(visible.length, "In view", true)}
      </dl>

      <Toolbar filters={filters} genres={genres} defaultSort={DEFAULT_SORT} />

      <p className={styles.status} role="status">
        {visible.length} of {books.length} volumes in view
        {sort !== "pile" ? ", shown as a catalog" : ""}
      </p>

      {sort === "pile" ? (
        <>
          {piles.length ? (
            <>
              <a className="skip-link" href="#past-chest">
                Skip past the chest
              </a>
              <div className={styles.scrollFrame} data-overflow={overflowing}>
                <div className={styles.scroller} ref={scrollerRef}>
                  <div className={styles.chest}>
                    {piles.map((n) => {
                      const inPile = booksOnShelf(placed, n);
                      /* slotsFor counts up from the bottom of the pile, and the
                         column is drawn in that same order: position 1 at the
                         top, the highest position down on the floor. */
                      const slots = slotsFor(placed, n);
                      return (
                        <section
                          key={n}
                          className={styles.pile}
                          aria-labelledby={`pile-${n}`}
                        >
                          <h2 id={`pile-${n}`} className={styles.pileTitle}>
                            Pile {n}
                          </h2>
                          <p className={`eyebrow ${styles.pileMeta}`}>
                            {inPile.length} volumes &middot;{" "}
                            {inPile.filter((b) => b.s === "Read").length} read
                          </p>
                          <div className={styles.pileBooks}>
                            {slots.map((slot) =>
                              slot.empty ? (
                                <div
                                  key={`empty-${n}-${slot.p}`}
                                  className={styles.empty}
                                  aria-hidden="true"
                                />
                              ) : (
                                slab(slot)
                              )
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                  <div className={styles.floor} />
                </div>
              </div>
              <div id="past-chest" tabIndex={-1} />
            </>
          ) : null}

          {loose.length ? (
            <section className={styles.loose} aria-labelledby="unplaced">
              <p className="eyebrow">In the chest</p>
              <h2 id="unplaced" className={styles.looseTitle}>
                Not yet placed
              </h2>
              <p className={styles.looseLede}>
                {loose.length} {loose.length === 1 ? "volume is" : "volumes are"} in the
                chest without a pile. Fill in Stack&nbsp;# and Position&nbsp;(B&nbsp;--&gt;&nbsp;T)
                in Notion and {loose.length === 1 ? "it moves" : "they move"} into the
                piles above.
              </p>
              <ul className={styles.catalog}>{loose.filter(matches).map(card)}</ul>
            </section>
          ) : null}
        </>
      ) : (
        <ul className={styles.catalog}>{catalog.map(card)}</ul>
      )}
    </main>
  );
}
