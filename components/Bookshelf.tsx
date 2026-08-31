"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Book } from "@/lib/notion";
import { booksOnShelf, shelfNumbers as shelvesIn, slotsFor } from "@/lib/shelf";
import { callNumber, cloth, height, weight } from "@/lib/spine";
import BookModal from "./BookModal";
import styles from "./Bookshelf.module.css";

const STATUSES = ["All", "Read", "Reading", "Unread"] as const;

const SORTS = [
  { value: "shelf", label: "Shelf order" },
  { value: "title", label: "Title, A to Z" },
  { value: "author", label: "Author, A to Z" },
  { value: "finished", label: "Recently finished" },
  { value: "rating", label: "Highest rated" },
] as const;

const label = (b: Book) =>
  `${b.t} by ${b.a}. Shelf ${b.sh}, position ${b.p}. ${b.s}.`;

export default function Bookshelf({ books }: { books: Book[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "All");
  const [genre, setGenre] = useState(() => searchParams.get("genre") ?? "All");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "shelf");
  const [selected, setSelected] = useState<Book | null>(null);

  const statusRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const [overflowing, setOverflowing] = useState(false);

  /* Filter state is mirrored into the URL so a view can be shared, bookmarked,
     and undone with the Back button. Debounced so typing does not push a
     history entry per keystroke. */
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
      if (sort !== "shelf") params.set("sort", sort);
      const query = params.toString();
      router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [q, status, genre, sort, router]);

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

  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.g.forEach((g) => set.add(g)));
    return ["All", ...Array.from(set).sort()];
  }, [books]);

  const shelfNumbers = useMemo(() => shelvesIn(books), [books]);

  const needle = q.trim().toLowerCase();

  const matches = useCallback(
    (b: Book) =>
      (status === "All" || b.s === status) &&
      (genre === "All" || b.g.includes(genre)) &&
      (!needle ||
        b.t.toLowerCase().includes(needle) ||
        b.a.toLowerCase().includes(needle)),
    [status, genre, needle]
  );

  const visible = useMemo(() => books.filter(matches), [books, matches]);
  const read = useMemo(() => books.filter((b) => b.s === "Read").length, [books]);

  /* Non-shelf orders break the physical-position metaphor, so they switch to an
     explicit catalog view rather than silently rearranging the shelves. */
  const catalog = useMemo(() => {
    const list = [...visible];
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
  }, [visible, sort]);

  const onStatusKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = STATUSES.length - 1;
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setStatus(STATUSES[next]);
    statusRefs.current[next]?.focus();
  };

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
      <button
        key={book.u}
        type="button"
        className={styles.spine}
        style={vars}
        data-read={book.s === "Read"}
        aria-label={label(book)}
        onClick={() => setSelected(book)}
      >
        {inner}
      </button>
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

      <div className={styles.toolbar}>
        <label className="visually-hidden" htmlFor="search">
          Search by title or author
        </label>
        <input
          id="search"
          type="search"
          className={styles.search}
          placeholder="Search title or author"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className={styles.group} role="radiogroup" aria-label="Filter by status">
          {STATUSES.map((s, i) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              tabIndex={status === s ? 0 : -1}
              ref={(el) => {
                statusRefs.current[i] = el;
              }}
              className={styles.chip}
              onClick={() => setStatus(s)}
              onKeyDown={(e) => onStatusKeyDown(e, i)}
            >
              {s}
            </button>
          ))}
        </div>

        <span className={styles.divider} aria-hidden="true" />

        <label className="visually-hidden" htmlFor="genre">
          Filter by subject
        </label>
        <select
          id="genre"
          className={styles.select}
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        >
          {genres.map((g) => (
            <option key={g} value={g}>
              {g === "All" ? "All subjects" : g}
            </option>
          ))}
        </select>

        <label className="visually-hidden" htmlFor="sort">
          Sort order
        </label>
        <select
          id="sort"
          className={styles.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

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
              <button
                type="button"
                className={styles.catalogItem}
                style={{ "--cloth": cloth(book) } as React.CSSProperties}
                aria-label={label(book)}
                onClick={() => setSelected(book)}
              >
                <p className={styles.catalogTitle}>{book.t}</p>
                <p className={styles.catalogAuthor}>{book.a}</p>
                <p className={styles.catalogMeta}>
                  <span>{callNumber(book)}</span>
                  <span>{book.s}</span>
                  {book.rating ? <span>{"★".repeat(book.rating)}</span> : null}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <BookModal book={selected} kind="shelf" onClose={() => setSelected(null)} />
    </main>
  );
}
