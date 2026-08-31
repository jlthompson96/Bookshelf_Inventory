"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isPlaced, type ChestBook } from "@/lib/notion";
import { booksOnShelf, shelfNumbers as pilesIn, slotsFor } from "@/lib/shelf";
import { callNumber, cloth, height, weight } from "@/lib/spine";
import BookModal from "./BookModal";
import styles from "./Chest.module.css";

const STATUSES = ["All", "Read", "Reading", "Unread"] as const;

const SORTS = [
  { value: "pile", label: "Pile order" },
  { value: "title", label: "Title, A to Z" },
  { value: "author", label: "Author, A to Z" },
  { value: "finished", label: "Recently finished" },
  { value: "rating", label: "Highest rated" },
] as const;

const label = (b: ChestBook) =>
  b.sh != null && b.p != null
    ? `${b.t} by ${b.a}. Pile ${b.sh}, position ${b.p} from the bottom. ${b.s}.`
    : `${b.t} by ${b.a}. Not yet placed in a pile. ${b.s}.`;

export default function Chest({ books }: { books: ChestBook[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "All");
  const [genre, setGenre] = useState(() => searchParams.get("genre") ?? "All");
  const [sort, setSort] = useState(() => searchParams.get("sort") ?? "pile");
  const [selected, setSelected] = useState<ChestBook | null>(null);

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
      if (sort !== "pile") params.set("sort", sort);
      const query = params.toString();
      router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
  }, [q, status, genre, sort, router]);

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

  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.g.forEach((g) => set.add(g)));
    return ["All", ...Array.from(set).sort()];
  }, [books]);

  const needle = q.trim().toLowerCase();

  const matches = useCallback(
    (b: ChestBook) =>
      (status === "All" || b.s === status) &&
      (genre === "All" || b.g.includes(genre)) &&
      (!needle ||
        b.t.toLowerCase().includes(needle) ||
        b.a.toLowerCase().includes(needle)),
    [status, genre, needle]
  );

  const visible = useMemo(() => books.filter(matches), [books, matches]);
  const read = useMemo(() => books.filter((b) => b.s === "Read").length, [books]);

  /* Non-pile orders break the physical-position metaphor, so they switch to an
     explicit catalog view rather than silently restacking the chest. */
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
      <button
        key={book.u}
        type="button"
        className={styles.slab}
        style={vars}
        data-read={book.s === "Read"}
        aria-label={label(book)}
        onClick={() => setSelected(book)}
      >
        {inner}
      </button>
    );
  };

  const card = (book: ChestBook) => (
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
          {callNumber(book) ? <span>{callNumber(book)}</span> : null}
          <span>{book.s}</span>
          {book.rating ? <span>{"★".repeat(book.rating)}</span> : null}
        </p>
      </button>
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

        {/* Every chest row starts with no Genre set, so the control is left out
            entirely until there is something to filter on rather than offered
            as a select with one inert option. */}
        {genres.length > 1 ? (
          <>
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
          </>
        ) : null}

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
                      /* slotsFor counts up from the bottom of the pile, so the
                         column is drawn in reverse: position 1 is the book
                         everything else is resting on. */
                      const slots = [...slotsFor(placed, n)].reverse();
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

      <BookModal book={selected} kind="chest" onClose={() => setSelected(null)} />
    </main>
  );
}
