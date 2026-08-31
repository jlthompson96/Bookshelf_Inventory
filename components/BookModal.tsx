"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ChestBook } from "@/lib/notion";
import type { BookInfo } from "@/lib/bookinfo";
import { callNumber, cloth, clothFor } from "@/lib/spine";
import styles from "./BookModal.module.css";

/* A Notion date arrives as "YYYY-MM-DD". Passing that to the Date constructor
   parses it as UTC midnight, which renders as the previous day for anyone west
   of Greenwich, so the parts are read directly instead. */
function formatFinished(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(y, m - 1, d));
}

const SOURCE_NAME: Record<BookInfo["source"], string> = {
  openlibrary: "Open Library",
  google: "Google Books",
};

/* Lookups are keyed on the pair that was searched, so reopening a card in the
   same session is instant and costs no request. It lives outside the component
   because the dialog unmounts nothing but its own state. */
const lookups = new Map<string, BookInfo | null>();
const cacheKey = (b: ChestBook) => `${b.t}|${b.a}`;

/* ChestBook rather than Book: its sh and p are nullable, so a shelved volume
   satisfies it too and one card serves both views. */
type Props = {
  book: ChestBook | null;
  /** Which inventory the card was opened from, so the whereabouts fact reads
      as a shelf or as a pile. */
  kind?: "shelf" | "chest";
  onClose: () => void;
};

export default function BookModal({ book, kind = "shelf", onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<BookInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const blurb = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (book && !dialog.open) dialog.showModal();
    if (!book && dialog.open) dialog.close();
  }, [book]);

  /* Catalogue data is fetched when a card opens rather than for the whole
     shelf, so a hundred spines cost nothing until one is actually read. */
  useEffect(() => {
    setExpanded(false);
    setClamped(false);

    if (!book) return;

    const key = cacheKey(book);
    if (lookups.has(key)) {
      setInfo(lookups.get(key) ?? null);
      setLoading(false);
      return;
    }

    /* The reader can close one spine and open another while a request is in
       flight, so the response is discarded unless it is still the one wanted. */
    const controller = new AbortController();
    let current = true;
    setInfo(null);
    setLoading(true);

    const query = new URLSearchParams({ title: book.t, author: book.a });
    fetch(`/api/books/info?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const found: BookInfo | null = data?.info ?? null;
        lookups.set(key, found);
        if (current) setInfo(found);
      })
      .catch(() => {
        if (current) setInfo(null);
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
      controller.abort();
    };
  }, [book]);

  /* The "read more" control is offered only when the blurb is genuinely cut
     off, which depends on the rendered width and so has to be measured. */
  useEffect(() => {
    const el = blurb.current;
    setClamped(!!el && el.scrollHeight > el.clientHeight + 4);
  }, [info]);

  /* `close` fires for Escape as well as for close(), so this is the single
     place the parent's state gets cleared. showModal() restores focus to the
     element that opened the dialog on its own. */
  const handleClose = () => {
    if (book) onClose();
  };

  /* Clicks on the backdrop are reported as clicks on the dialog itself. The
     dialog carries no padding, so anything landing on it directly is backdrop. */
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) ref.current?.close();
  };

  /* A cover id can outlive the image behind it. Dropping the URL falls the
     plate back to its cloth colour rather than leaving a broken image. */
  const handleCoverError = useCallback(() => {
    setInfo((prev) => (prev ? { ...prev, cover: undefined } : prev));
  }, []);

  const pages = book?.pages ?? info?.pages;
  const plate = book ? callNumber(book) : null;

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby="book-modal-title"
      onClose={handleClose}
      onClick={handleClick}
      style={{ "--cloth": book ? cloth(book) : "transparent" } as React.CSSProperties}
    >
      {book ? (
        <div className={styles.inner}>
          <div className={styles.top}>
            <span className={styles.topMeta}>
              {plate ? <span>{plate}</span> : null}
              <span>{book.s}</span>
            </span>
            <button
              type="button"
              className={styles.close}
              onClick={() => ref.current?.close()}
            >
              <span aria-hidden="true">&times;</span>
              <span className="visually-hidden">Close</span>
            </button>
          </div>

          <div className={styles.head}>
            {/* The plate is always drawn so the card keeps its geometry whether
                a cover arrives, fails, or was never found. */}
            <div
              className={`${styles.plate} ${loading ? styles.platePending : ""}`}
              aria-hidden="true"
            >
              {info?.cover ? (
                <img
                  className={styles.cover}
                  src={info.cover}
                  alt=""
                  width={180}
                  height={270}
                  loading="lazy"
                  onError={handleCoverError}
                />
              ) : null}
            </div>

            <div className={styles.headText}>
              <h3 id="book-modal-title" className={styles.title}>
                {book.t}
              </h3>
              <p className={styles.author}>{book.a}</p>
            </div>
          </div>

          {book.g.length ? (
            <div className={styles.section}>
              <p className={styles.sectionLabel}>Subject headings</p>
              <ul className={styles.genres}>
                {book.g.map((g) => (
                  <li
                    key={g}
                    className={styles.genre}
                    style={{ "--genre": clothFor(g) } as React.CSSProperties}
                  >
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <dl className={styles.facts}>
            {/* Omitted rather than blank for a chest book with no pile assigned
                yet: "Pile —, position —" would read as missing data on the card
                rather than as a book simply not put away yet. */}
            {book.sh != null && book.p != null ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>{kind === "chest" ? "Pile" : "Shelf"}</dt>
                <dd className={styles.factValue}>
                  {book.sh}, position {book.p}
                </dd>
              </div>
            ) : (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Pile</dt>
                <dd className={styles.factValue}>Not yet placed</dd>
              </div>
            )}
            {pages ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Pages</dt>
                <dd className={styles.factValue}>{pages}</dd>
              </div>
            ) : null}
            {book.rating ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Rating</dt>
                <dd className={styles.factValue}>
                  <span className={styles.stars} aria-hidden="true">
                    {"★".repeat(book.rating)}
                    {"☆".repeat(Math.max(0, 5 - book.rating))}
                  </span>
                  <span className="visually-hidden">{book.rating} out of 5</span>
                </dd>
              </div>
            ) : null}
            {book.finished ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Finished</dt>
                <dd className={styles.factValue}>{formatFinished(book.finished)}</dd>
              </div>
            ) : null}
            {info?.year ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Published</dt>
                <dd className={styles.factValue}>{info.year}</dd>
              </div>
            ) : null}
            {info?.publisher ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Publisher</dt>
                <dd className={styles.factValue}>{info.publisher}</dd>
              </div>
            ) : null}
            {info?.isbn ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>ISBN</dt>
                <dd className={styles.factValue}>{info.isbn}</dd>
              </div>
            ) : null}
          </dl>

          <div aria-busy={loading}>
            {loading ? (
              <div className={styles.section} aria-hidden="true">
                <p className={styles.sectionLabel}>About</p>
                <div className={styles.skeleton}>
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}

            {info?.description ? (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>About</p>
                <p
                  ref={blurb}
                  className={`${styles.blurb} ${expanded ? "" : styles.blurbClamped}`}
                >
                  {info.description}
                </p>
                {clamped ? (
                  <button
                    type="button"
                    className={styles.more}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? "Show less" : "Read more"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {info?.subjects?.length ? (
              <div className={styles.section}>
                <p className={styles.sectionLabel}>Catalogue subjects</p>
                <ul className={styles.subjects}>
                  {info.subjects.map((s) => (
                    <li key={s} className={styles.subject}>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className={styles.footer}>
            <a
              className={styles.notionLink}
              href={book.u}
              target="_blank"
              rel="noreferrer"
            >
              View in Notion
              <span className="visually-hidden"> (opens in a new tab)</span>
            </a>
            {info ? (
              <a
                className={styles.sourceLink}
                href={info.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Details from {SOURCE_NAME[info.source]}
                <span className="visually-hidden"> (opens in a new tab)</span>
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
