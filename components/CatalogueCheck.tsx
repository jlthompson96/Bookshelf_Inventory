"use client";

import { useState } from "react";
import styles from "@/app/doctor/doctor.module.css";

/** The covers endpoint's own cap — see app/api/books/covers/route.ts. */
const BATCH = 24;

type Item = { id: string; t: string; a: string; u: string };

type Result = { misses: Item[]; errored: number };

/**
 * The one check the doctor page does not run on load: whether the catalogue
 * lookup matches each book at all. It costs one request per 24 books against
 * the same endpoint the gallery already batches through, which for the whole
 * collection is real time and real upstream load — worth spending only when
 * asked, not on every visit to this page.
 */
export default function CatalogueCheck({ books }: { books: Item[] }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [checked, setChecked] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setState("running");
    setChecked(0);
    const misses: Item[] = [];
    let errored = 0;

    for (let i = 0; i < books.length; i += BATCH) {
      const batch = books.slice(i, i + BATCH);
      try {
        const res = await fetch(`/api/books/covers?ids=${batch.map((b) => b.id).join(",")}`);
        const data = res.ok ? await res.json() : null;
        if (!data?.covers) {
          errored += batch.length;
        } else {
          for (const b of batch) if (data.covers[b.id] == null) misses.push(b);
        }
      } catch {
        /* A network failure is not a catalogue miss — counted separately so a
           dropped connection cannot masquerade as "this book doesn't exist". */
        errored += batch.length;
      }
      setChecked((n) => n + batch.length);
    }

    setResult({ misses, errored });
    setState("done");
  };

  if (!books.length) return null;

  return (
    <div className={styles.catalogue}>
      {state === "idle" && (
        <button type="button" className={styles.runButton} onClick={run}>
          Check {books.length} books against the catalogue
        </button>
      )}

      {state === "running" && (
        <p className={styles.body} role="status">
          Checking… {checked} of {books.length}
        </p>
      )}

      {state === "done" && result && (
        <div>
          {result.errored > 0 && (
            <p className={styles.footnote}>
              {result.errored} book{result.errored === 1 ? "" : "s"} could not be checked —
              a request failed rather than the catalogue answering. Not counted as a miss.
            </p>
          )}
          {result.misses.length === 0 ? (
            <p className={styles.body}>
              Every book checked matched something in Open Library or Google Books.
            </p>
          ) : (
            <>
              <p className={styles.body}>
                {result.misses.length} of {books.length} books matched neither catalogue —
                these show a cloth binding instead of a cover in the gallery.
              </p>
              <ul className={styles.items}>
                {result.misses.map((b) => (
                  <li key={b.id}>
                    <a className={styles.itemLink} href={`/book/${b.id}`}>
                      {b.t}
                    </a>
                    <span className={styles.byline}> by {b.a}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className={styles.runButton} onClick={run}>
            Check again
          </button>
        </div>
      )}
    </div>
  );
}
