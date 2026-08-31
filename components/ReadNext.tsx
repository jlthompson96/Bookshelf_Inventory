"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { ChestBook } from "@/lib/notion";
import { bookHref } from "@/lib/href";
import { callNumber, clothFor } from "@/lib/spine";
import styles from "./ReadNext.module.css";

/**
 * "What to read next": a nudge toward the next book off the pile.
 *
 * Two ways in, sharing one candidate pool — the books marked Unread on the
 * shelf and in the chest. A random pick answers "just tell me what to read",
 * and a short set of questions narrows the pool for "help me decide". Both end
 * at a book's catalog card, which opens as the same intercepting modal every
 * other browsing view uses.
 *
 * Only properties that exist in both databases drive the questions: subject
 * (Genre) and location (shelf or chest), plus whether the author is one already
 * marked Read. Pages, Rating and Date Finished are optional and currently absent
 * from both databases — see /doctor — so nothing here asks about length or how
 * well something scored.
 */

type From = "shelf" | "chest";
type Tagged = ChestBook & { from: From };
type Mode = "pick" | "guided";

/** A guided answer of "" means no preference on that axis. */
type Answers = { mood: string; where: "" | From; author: "" | "known" | "new" };

const EMPTY_ANSWERS: Answers = { mood: "", where: "", author: "" };

/* A shuffled copy, Fisher–Yates rather than sort(() => Math.random() - 0.5),
   which is biased and on some engines not even a permutation. Called only from
   event handlers and effects, never during render, so the server and client
   markup never disagree over a random result. */
function shuffled<T>(list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const fold = (s: string) => s.trim().toLowerCase();

const whereabouts = (b: Tagged): string => {
  if (b.from === "shelf") return `On the shelf · Shelf ${b.sh}, position ${b.p}`;
  if (b.sh != null && b.p != null) return `In the chest · Pile ${b.sh}, position ${b.p}`;
  return "In the chest · not yet in a pile";
};

/**
 * One single-select control, built as a radiogroup with a roving tabindex and
 * arrow-key support — the same pattern the shared Toolbar uses for the status
 * filter, so the two cannot drift apart on the accessibility behaviour the
 * project commits to.
 */
function ChoiceGroup<T extends string>({
  labelledBy,
  ariaLabel,
  value,
  options,
  onChange,
}: {
  labelledBy?: string;
  ariaLabel?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = options.length - 1;
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
    >
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={styles.chip}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Suggestion({ book }: { book: Tagged }) {
  const plate = callNumber(book);
  return (
    <article
      className={styles.suggestion}
      style={{ "--cloth": clothFor(book.g[0]) } as React.CSSProperties}
    >
      <p className={`eyebrow ${styles.suggestionMeta}`}>
        {plate ? <span>{plate}</span> : null}
        <span>{book.s}</span>
      </p>
      <h3 className={styles.suggestionTitle}>
        <Link href={bookHref(book)} className={styles.suggestionLink}>
          {book.t}
        </Link>
      </h3>
      <p className={styles.suggestionAuthor}>{book.a}</p>
      {book.g.length ? (
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
      ) : null}
      <p className={styles.where}>{whereabouts(book)}</p>
    </article>
  );
}

export default function ReadNext({
  shelf,
  chest,
}: {
  shelf: ChestBook[];
  chest: ChestBook[];
}) {
  const books = useMemo<Tagged[]>(
    () => [
      ...shelf.map((b) => ({ ...b, from: "shelf" as const })),
      ...chest.map((b) => ({ ...b, from: "chest" as const })),
    ],
    [shelf, chest]
  );

  /* What "read next" chooses between: the Unread rows. A book being read right
     now is in progress rather than a candidate, and a read one is done. */
  const waiting = useMemo(() => books.filter((b) => b.s === "Unread"), [books]);

  /* Authors carrying at least one book already marked Read, folded for a
     forgiving compare. "Unknown" is the placeholder toBook writes for a blank
     author, so it never counts as an author you know. */
  const knownAuthors = useMemo(() => {
    const set = new Set<string>();
    for (const b of books) {
      if (b.s === "Read" && b.a && b.a !== "Unknown") set.add(fold(b.a));
    }
    return set;
  }, [books]);

  const isKnownAuthor = useCallback(
    (b: Tagged) => b.a !== "Unknown" && knownAuthors.has(fold(b.a)),
    [knownAuthors]
  );

  const moods = useMemo(() => {
    const set = new Set<string>();
    waiting.forEach((b) => b.g.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [waiting]);

  /* The author question only earns its place if it can actually split the pool:
     some waiting book by an author you have read, and some by one you have not. */
  const authorSplit = useMemo(() => {
    let known = 0;
    let fresh = 0;
    for (const b of waiting) (isKnownAuthor(b) ? known++ : fresh++);
    return known > 0 && fresh > 0;
  }, [waiting, isKnownAuthor]);

  const [mode, setMode] = useState<Mode>("pick");

  // --- random pick -----------------------------------------------------------
  const [pick, setPick] = useState<Tagged | null>(null);
  /* Ids shown since the last reset, so "another" works through the whole pile
     before it repeats anything. */
  const seen = useRef<Set<string>>(new Set());

  const roll = useCallback(() => {
    if (!waiting.length) return;
    let pool = waiting.filter((b) => !seen.current.has(b.id));
    if (!pool.length) {
      seen.current = new Set();
      pool = waiting;
    }
    const next = shuffled(pool)[0];
    seen.current.add(next.id);
    setPick(next);
  }, [waiting]);

  /* First pick after mount, not in render: Math.random() on the server would
     not agree with the client and the card would flash a different book. */
  const rolled = useRef(false);
  useEffect(() => {
    if (rolled.current) return;
    rolled.current = true;
    roll();
  }, [roll]);

  // --- guided --------------------------------------------------------------
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [shortlist, setShortlist] = useState<Tagged[]>([]);
  const [submitted, setSubmitted] = useState(false);

  /* Any change to an answer drops back to the questions: the shortlist was a
     sample of the previous pool and would otherwise sit there looking current. */
  const update = useCallback((patch: Partial<Answers>) => {
    setAnswers((prev) => ({ ...prev, ...patch }));
    setSubmitted(false);
  }, []);

  const matchesAnswers = useCallback(
    (b: Tagged, a: Answers) =>
      (!a.mood || b.g.includes(a.mood)) &&
      (!a.where || b.from === a.where) &&
      (!a.author || (a.author === "known") === isKnownAuthor(b)),
    [isKnownAuthor]
  );

  const matches = useMemo(
    () => waiting.filter((b) => matchesAnswers(b, answers)),
    [waiting, answers, matchesAnswers]
  );

  const countWith = useCallback(
    (patch: Partial<Answers>) =>
      waiting.filter((b) => matchesAnswers(b, { ...answers, ...patch })).length,
    [waiting, answers, matchesAnswers]
  );

  const show = useCallback(() => {
    setShortlist(shuffled(matches).slice(0, 3));
    setSubmitted(true);
  }, [matches]);

  const hasAnswers = !!(answers.mood || answers.where || answers.author);

  if (!waiting.length) {
    return (
      <main className={`${styles.page} ${styles.emptyState}`}>
        <p className="eyebrow">What to read next</p>
        <h1 className={styles.title}>Nothing waiting</h1>
        <p className={styles.lede}>
          {books.length
            ? "Every book on the shelf and in the chest is marked Read or Reading. Set one back to Unread in Notion and it turns up here."
            : "Notion answered, but no titled rows came back from either database."}
        </p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>What to read next</h1>
        <p className={styles.lede}>
          {waiting.length} {waiting.length === 1 ? "book is" : "books are"} waiting on the
          shelf and in the chest. Take a pick at random, or answer a couple of questions to
          narrow it down.
        </p>
      </header>

      <ChoiceGroup
        ariaLabel="How to choose"
        value={mode}
        onChange={setMode}
        options={[
          { value: "pick", label: "Random pick" },
          { value: "guided", label: "Ask me" },
        ]}
      />

      {mode === "pick" ? (
        <section className={styles.panel} aria-labelledby="pick-h">
          <h2 id="pick-h" className={styles.sectionTitle}>
            A pick at random
          </h2>
          <p className={styles.count} role="status">
            One of {waiting.length}, drawn without looking.
          </p>
          <div className={styles.stage}>{pick ? <Suggestion book={pick} /> : null}</div>
          <button type="button" className={styles.action} onClick={roll}>
            Pick another
          </button>
        </section>
      ) : (
        <section className={styles.panel} aria-labelledby="guided-h">
          <h2 id="guided-h" className={styles.sectionTitle}>
            Narrow it down
          </h2>

          <div className={styles.questions}>
            <div className={styles.question}>
              <p id="q-mood" className={styles.legend}>
                What are you in the mood for?
              </p>
              <ChoiceGroup
                labelledBy="q-mood"
                value={answers.mood}
                onChange={(v) => update({ mood: v })}
                options={[
                  { value: "", label: "Anything" },
                  ...moods.map((m) => ({ value: m, label: m })),
                ]}
              />
            </div>

            <div className={styles.question}>
              <p id="q-where" className={styles.legend}>
                From where?
              </p>
              <ChoiceGroup
                labelledBy="q-where"
                value={answers.where}
                onChange={(v) => update({ where: v })}
                options={[
                  { value: "", label: "Either" },
                  { value: "shelf", label: "The shelf" },
                  { value: "chest", label: "The chest" },
                ]}
              />
            </div>

            {authorSplit ? (
              <div className={styles.question}>
                <p id="q-author" className={styles.legend}>
                  The author?
                </p>
                <ChoiceGroup
                  labelledBy="q-author"
                  value={answers.author}
                  onChange={(v) => update({ author: v })}
                  options={[
                    { value: "", label: "No preference" },
                    { value: "known", label: "One I've read" },
                    { value: "new", label: "Someone new" },
                  ]}
                />
              </div>
            ) : null}
          </div>

          <p className={styles.count} role="status">
            {matches.length} of {waiting.length} waiting {matches.length === 1 ? "book" : "books"}{" "}
            {matches.length === 1 ? "fits" : "fit"}
            {hasAnswers ? " that" : ""}.
          </p>

          {matches.length ? (
            !submitted ? (
              <button type="button" className={styles.action} onClick={show}>
                Show me a few
              </button>
            ) : matches.length > shortlist.length ? (
              <button type="button" className={styles.action} onClick={show}>
                Shuffle the shortlist
              </button>
            ) : null
          ) : (
            <div className={styles.relax}>
              <p className={styles.relaxLead}>Nothing fits all of that. Loosen one:</p>
              <div className={styles.relaxRow}>
                {answers.mood ? (
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => update({ mood: "" })}
                  >
                    Any subject → {countWith({ mood: "" })}
                  </button>
                ) : null}
                {answers.where ? (
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => update({ where: "" })}
                  >
                    Anywhere → {countWith({ where: "" })}
                  </button>
                ) : null}
                {answers.author ? (
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => update({ author: "" })}
                  >
                    Any author → {countWith({ author: "" })}
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {submitted && shortlist.length ? (
            <>
              <p className={`eyebrow ${styles.shortlistLabel}`}>
                {shortlist.length === matches.length
                  ? shortlist.length === 1
                    ? "The one that fits"
                    : "The ones that fit"
                  : `${shortlist.length} of the ${matches.length}`}
              </p>
              <ul className={styles.shortlist}>
                {shortlist.map((b) => (
                  <li key={b.id}>
                    <Suggestion book={b} />
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {hasAnswers ? (
            <button
              type="button"
              className={styles.reset}
              onClick={() => update(EMPTY_ANSWERS)}
            >
              Start over
            </button>
          ) : null}
        </section>
      )}
    </main>
  );
}
