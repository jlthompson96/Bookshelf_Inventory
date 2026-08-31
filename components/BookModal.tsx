"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChestBook } from "@/lib/notion";
import type { BookInfo } from "@/lib/bookinfo";
import { cloth } from "@/lib/spine";
import BookCard from "./BookCard";
import styles from "./BookModal.module.css";

/**
 * The card as a dialog over whichever view opened it.
 *
 * There is no `open` prop and no `selected` state behind it any more: the card
 * is a route now, so the modal being mounted *is* it being open, and dismissing
 * it is a navigation. That is what makes an open card a URL someone can send.
 *
 * `<dialog>` supplies focus trapping, Escape, and top-layer stacking, so the
 * only thing to arrange is that every route out of it — Escape, the button, the
 * backdrop — goes back rather than closing a hidden piece of state.
 */

/* Lookups are keyed on the book id, so reopening a card in the same session is
   instant and costs no request. Shared with the gallery, which fills it in
   bulk: a tile whose cover has already loaded opens its card with the plate
   already populated. Lives outside the component because the dialog unmounts
   with the route. */
export const lookups = new Map<string, BookInfo | null>();

type Props = {
  book: ChestBook;
  kind?: "shelf" | "chest";
  /** Supplied when the server already did the lookup; otherwise fetched here. */
  info?: BookInfo | null;
};

export default function BookModal({ book, kind = "shelf", info: given }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<BookInfo | null>(given ?? lookups.get(book.id) ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  /* Catalogue data is fetched when a card opens rather than for the whole
     shelf, so a hundred spines cost nothing until one is actually read. */
  useEffect(() => {
    if (given !== undefined) return;
    if (lookups.has(book.id)) {
      setInfo(lookups.get(book.id) ?? null);
      setLoading(false);
      return;
    }

    /* The reader can close one card and open another while a request is in
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
        lookups.set(book.id, found);
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
  }, [book.id, book.t, book.a, given]);

  /* `close` fires for Escape as well as for close(), so this is the single
     place the navigation happens. showModal() restores focus to the element
     that opened the dialog on its own. */
  const handleClose = () => router.back();

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
      style={{ "--cloth": cloth(book) } as React.CSSProperties}
    >
      <BookCard
        book={book}
        kind={kind}
        info={info}
        loading={loading}
        titleId="book-modal-title"
        onClose={() => ref.current?.close()}
      />
    </dialog>
  );
}
