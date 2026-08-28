"use client";

import React, { useEffect, useRef } from "react";
import type { Book } from "@/lib/notion";
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

type Props = {
  book: Book | null;
  cloth: (b: Book) => string;
  clothFor: (genre: string) => string;
  callNumber: (b: Book) => string;
  onClose: () => void;
};

export default function BookModal({ book, cloth, clothFor, callNumber, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (book && !dialog.open) dialog.showModal();
    if (!book && dialog.open) dialog.close();
  }, [book]);

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
              <span>{callNumber(book)}</span>
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

          <h3 id="book-modal-title" className={styles.title}>
            {book.t}
          </h3>
          <p className={styles.author}>{book.a}</p>

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
            <div className={styles.fact}>
              <dt className={styles.factLabel}>Shelf</dt>
              <dd className={styles.factValue}>
                {book.sh}, position {book.p}
              </dd>
            </div>
            {book.pages ? (
              <div className={styles.fact}>
                <dt className={styles.factLabel}>Pages</dt>
                <dd className={styles.factValue}>{book.pages}</dd>
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
          </dl>

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
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
