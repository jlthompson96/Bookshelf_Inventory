"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ChestBook } from "@/lib/notion";
import type { BookInfo } from "@/lib/bookinfo";
import { formatFinished } from "@/lib/dates";
import { callNumber, clothFor } from "@/lib/spine";
import styles from "./BookModal.module.css";

/**
 * The catalog card itself, with no opinion about where it is drawn.
 *
 * Two things render it: the dialog on the shelf, which looks its subject up in
 * the browser as the card opens, and the standalone page at /book/<id>, which
 * has the catalogue data already because the server fetched it. So the lookup
 * is a prop rather than something this component does — the page would
 * otherwise re-request on the client what it had rendered on the server.
 */

const SOURCE_NAME: Record<BookInfo["source"], string> = {
  openlibrary: "Open Library",
  google: "Google Books",
};

type Props = {
  /* ChestBook rather than Book: its sh and p are nullable, so a shelved volume
     satisfies it too and one card serves both views. */
  book: ChestBook;
  /** Which inventory the card was opened from, so the whereabouts fact reads
      as a shelf or as a pile. */
  kind?: "shelf" | "chest";
  info: BookInfo | null;
  loading?: boolean;
  /** The dialog's dismiss control. Omitted on the standalone page, which is
      left with the browser's own Back. */
  onClose?: () => void;
  /** The heading id, so the dialog can point aria-labelledby at it. */
  titleId?: string;
  /** `h1` on the standalone page, where the card is the whole document. */
  as?: "h1" | "h3";
};

export default function BookCard({
  book,
  kind = "shelf",
  info,
  loading = false,
  onClose,
  titleId = "book-card-title",
  as: Heading = "h3",
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const [cover, setCover] = useState(info?.cover);
  const blurb = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
    setClamped(false);
    setCover(info?.cover);
  }, [info, book]);

  /* The "read more" control is offered only when the blurb is genuinely cut
     off, which depends on the rendered width and so has to be measured. */
  useEffect(() => {
    const el = blurb.current;
    setClamped(!!el && el.scrollHeight > el.clientHeight + 4);
  }, [info]);

  /* A cover id can outlive the image behind it. Dropping the URL falls the
     plate back to its cloth colour rather than leaving a broken image. */
  const handleCoverError = useCallback(() => setCover(undefined), []);

  const pages = book.pages ?? info?.pages;
  const plate = callNumber(book);

  return (
    <div className={styles.inner}>
      <div className={styles.top}>
        <span className={styles.topMeta}>
          {plate ? <span>{plate}</span> : null}
          <span>{book.s}</span>
        </span>
        {onClose ? (
          <button type="button" className={styles.close} onClick={onClose}>
            <span aria-hidden="true">&times;</span>
            <span className="visually-hidden">Close</span>
          </button>
        ) : null}
      </div>

      <div className={styles.head}>
        {/* The plate is always drawn so the card keeps its geometry whether
            a cover arrives, fails, or was never found. */}
        <div
          className={`${styles.plate} ${loading ? styles.platePending : ""}`}
          aria-hidden="true"
        >
          {cover ? (
            <img
              className={styles.cover}
              src={cover}
              alt=""
              width={180}
              height={270}
              loading="lazy"
              onError={handleCoverError}
            />
          ) : null}
        </div>

        <div className={styles.headText}>
          <Heading id={titleId} className={styles.title}>
            {book.t}
          </Heading>
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
        <a className={styles.notionLink} href={book.u} target="_blank" rel="noreferrer">
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
  );
}
