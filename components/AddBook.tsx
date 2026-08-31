"use client";

import { useMemo, useState } from "react";
import type { Book, Schema } from "@/lib/notion";
import type { ScannedBook } from "@/lib/bookinfo";
import { normalizeIsbn } from "@/lib/isbn";
import { nextFreePosition, occupantAt, shelfNumbers } from "@/lib/shelf";
import Scanner from "./Scanner";
import styles from "./AddBook.module.css";

type Draft = {
  title: string;
  author: string;
  status: string;
  shelf: string;
  position: string;
  genres: string[];
  pages: string;
  rating: string;
};

const STATUSES = ["Unread", "Reading", "Read"];

const blank = (shelf: string, position: string): Draft => ({
  title: "",
  author: "",
  status: "Unread",
  shelf,
  position,
  genres: [],
  pages: "",
  rating: "",
});

export default function AddBook({ books: initial, schema }: { books: Book[]; schema: Schema }) {
  /* The server snapshot goes stale the moment the first book is shelved, and
     this page is built to be used several times in a row. Appending locally
     keeps the slot suggestion and the collision warning honest across a run
     without a round trip; the endpoint's 409 remains the real guard. */
  const [added, setAdded] = useState<Book[]>([]);
  const books = useMemo(() => [...initial, ...added], [initial, added]);

  const shelves = useMemo(() => {
    /* Notion's own select options are the source of truth, so a shelf that
       exists but is currently empty can still be filled. Shelves in use are
       merged in so a stale schema cannot hide one. */
    const all = new Set([...schema.shelves, ...shelfNumbers(books).map(String)]);
    return Array.from(all)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b)
      .map(String);
  }, [books, schema.shelves]);

  const statuses = schema.statuses.length ? schema.statuses : STATUSES;
  const firstShelf = shelves[0] ?? "1";

  const [draft, setDraft] = useState<Draft>(() =>
    blank(firstShelf, String(nextFreePosition(books, Number(firstShelf))))
  );
  const [isbn, setIsbn] = useState("");
  const [cover, setCover] = useState<string | undefined>();
  /* Facts the catalogue returned that this database has no property for. Shown
     rather than dropped: they are how you confirm the scan found the right
     edition before writing it. */
  const [lookedUp, setLookedUp] = useState<{
    pages?: number;
    year?: number;
    publisher?: string;
  } | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "note"; text: string } | null>(null);
  const [saved, setSaved] = useState<{ url: string; title: string } | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  /* Changing shelf re-suggests the slot, since a position that was free on one
     shelf says nothing about another. */
  const setShelf = (value: string) =>
    setDraft((d) => ({
      ...d,
      shelf: value,
      position: String(nextFreePosition(books, Number(value))),
    }));

  const occupant = useMemo(() => {
    const sh = Number(draft.shelf);
    const p = Number(draft.position);
    if (!Number.isFinite(sh) || !Number.isFinite(p)) return undefined;
    return occupantAt(books, sh, p);
  }, [books, draft.shelf, draft.position]);

  async function lookup(raw: string) {
    const clean = normalizeIsbn(raw);
    if (!clean) {
      setMessage({ kind: "error", text: "That is not a valid ISBN. Check the digits." });
      return;
    }

    setIsbn(clean);
    setLooking(true);
    setMessage(null);
    setSaved(null);

    try {
      const res = await fetch(`/api/books/isbn?isbn=${clean}`);
      const { book } = (await res.json()) as { book: ScannedBook | null };

      if (!book) {
        setMessage({
          kind: "note",
          text: "Neither catalogue knows that ISBN. Fill the details in by hand.",
        });
        setCover(undefined);
        setLookedUp(null);
        return;
      }

      setCover(book.cover);
      setLookedUp({ pages: book.pages, year: book.year, publisher: book.publisher });
      /* Only subjects Notion already has as Genre options are taken: a genre it
         has never seen would come back grey on the shelf, having no cloth
         colour, which reads as a mistake rather than a new category. */
      const known = new Set(schema.genres.map((g) => g.toLowerCase()));
      const genres = (book.subjects ?? []).filter((s) => known.has(s.toLowerCase()));

      setDraft((d) => ({
        ...d,
        title: book.title,
        author: book.author || "Unknown",
        pages: book.pages ? String(book.pages) : "",
        genres: genres.length ? genres.slice(0, 3) : d.genres,
      }));
    } catch {
      setMessage({ kind: "error", text: "The lookup failed. Fill the details in by hand." });
    } finally {
      setLooking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          author: draft.author,
          status: draft.status,
          shelf: Number(draft.shelf),
          position: Number(draft.position),
          genres: draft.genres,
          pages: draft.pages ? Number(draft.pages) : undefined,
          rating: draft.rating ? Number(draft.rating) : undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: body.detail ?? body.error ?? "The save failed." });
        return;
      }

      const shelved: Book = {
        id: body.id,
        t: draft.title,
        a: draft.author || "Unknown",
        s: draft.status as Book["s"],
        sh: Number(draft.shelf),
        p: Number(draft.position),
        g: draft.genres,
        u: body.url,
        pages: draft.pages ? Number(draft.pages) : undefined,
        rating: draft.rating ? Number(draft.rating) : undefined,
      };
      const next = [...added, shelved];

      setAdded(next);
      setSaved({ url: body.url, title: draft.title });
      setDraft(blank(draft.shelf, String(nextFreePosition([...initial, ...next], Number(draft.shelf)))));
      setIsbn("");
      setCover(undefined);
      setLookedUp(null);
    } catch {
      setMessage({ kind: "error", text: "The save failed. Check the connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  const busy = looking || saving;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>Shelve a book</h1>
        <p className={styles.lede}>
          Scan the barcode on the back cover, or type its ISBN. The catalogue fills in what
          it knows and the shelf suggests the next open slot; everything stays editable
          before it is written to Notion.
        </p>
      </header>

      <section className={styles.capture} aria-labelledby="capture-heading">
        <h2 id="capture-heading" className="eyebrow">
          Step one — identify
        </h2>

        <Scanner onFound={lookup} busy={busy} />

        <form
          className={styles.isbnRow}
          onSubmit={(e) => {
            e.preventDefault();
            lookup(isbn);
          }}
        >
          <label className="visually-hidden" htmlFor="isbn">
            ISBN
          </label>
          <input
            id="isbn"
            className={styles.input}
            inputMode="numeric"
            autoComplete="off"
            placeholder="ISBN, e.g. 9780547928227"
            value={isbn}
            onChange={(e) => setIsbn(e.target.value)}
          />
          <button type="submit" className={styles.chip} disabled={!isbn.trim() || busy}>
            {looking ? "Looking…" : "Look up"}
          </button>
        </form>
      </section>

      {message ? (
        <p
          className={message.kind === "error" ? styles.error : styles.note}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}

      {saved ? (
        <p className={styles.saved} role="status">
          Shelved <strong>{saved.title}</strong>.{" "}
          <a href={saved.url} target="_blank" rel="noreferrer">
            Open in Notion
            <span className="visually-hidden"> (opens in a new tab)</span>
          </a>
          {" · "}
          <a href="/">Back to the shelf</a>
        </p>
      ) : null}

      <form className={styles.form} onSubmit={submit} aria-labelledby="details-heading">
        <h2 id="details-heading" className="eyebrow">
          Step two — shelve
        </h2>

        <div className={styles.grid}>
          {cover || lookedUp ? (
            <div className={styles.aside}>
              {cover ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img className={styles.cover} src={cover} alt="" />
              ) : null}
              {lookedUp ? (
                <p className={styles.facts}>
                  {[
                    lookedUp.year,
                    lookedUp.publisher,
                    lookedUp.pages ? `${lookedUp.pages} pages` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className={styles.fields}>
            <label className={styles.field}>
              <span className={styles.label}>Title</span>
              <input
                className={styles.input}
                required
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>Author</span>
              <input
                className={styles.input}
                value={draft.author}
                onChange={(e) => set("author", e.target.value)}
              />
            </label>

            <div className={styles.pair}>
              <label className={styles.field}>
                <span className={styles.label}>Shelf</span>
                <select
                  className={styles.select}
                  value={draft.shelf}
                  onChange={(e) => setShelf(e.target.value)}
                >
                  {shelves.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Position</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  required
                  value={draft.position}
                  onChange={(e) => set("position", e.target.value)}
                  aria-describedby={occupant ? "slot-taken" : undefined}
                />
              </label>
            </div>

            {occupant ? (
              <p id="slot-taken" className={styles.error} role="alert">
                Shelf {draft.shelf}, position {draft.position} already holds “{occupant.t}”.
              </p>
            ) : null}

            <div className={styles.pair}>
              <label className={styles.field}>
                <span className={styles.label}>Status</span>
                <select
                  className={styles.select}
                  value={draft.status}
                  onChange={(e) => set("status", e.target.value)}
                >
                  {statuses.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              {/* Only where the database defines it. Offering a field Notion
                  has no property for would fail the whole create. */}
              {schema.has.pages ? (
                <label className={styles.field}>
                  <span className={styles.label}>Pages</span>
                  <input
                    className={styles.input}
                    type="number"
                    min={1}
                    value={draft.pages}
                    onChange={(e) => set("pages", e.target.value)}
                  />
                </label>
              ) : null}
            </div>

            <fieldset className={styles.fieldset}>
              <legend className={styles.label}>Genre</legend>
              <div className={styles.group}>
                {schema.genres.map((g) => {
                  const on = draft.genres.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      className={styles.chip}
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "genres",
                          on ? draft.genres.filter((x) => x !== g) : [...draft.genres, g]
                        )
                      }
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.submit}
            disabled={!draft.title.trim() || !!occupant || busy}
          >
            {saving ? "Shelving…" : "Shelve it"}
          </button>
          <a className={styles.back} href="/">
            Back to the shelf
          </a>
        </div>
      </form>
    </main>
  );
}
