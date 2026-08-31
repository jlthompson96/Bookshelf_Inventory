"use client";

import React, { useRef } from "react";
import { COMMON_SORTS, STATUSES, type Filters } from "@/lib/filters";
import styles from "./Toolbar.module.css";

/**
 * The inventory controls, shared by the shelf, the chest and the gallery.
 *
 * The three views had grown identical copies of this markup, and it carries the
 * accessibility behaviour the project commits to: the status filters are a
 * radiogroup with a roving tabindex and arrow-key support, and signal selection
 * with weight and a marker as well as colour. One copy is what keeps that from
 * drifting apart in the two views nobody happened to be editing.
 */

type Extra = { value: string; label: string };

type Props = {
  filters: Filters & {
    setQ: (v: string) => void;
    setStatus: (v: string) => void;
    setGenre: (v: string) => void;
    setSort: (v: string) => void;
  };
  genres: string[];
  /** The view's own positional order — "Shelf order", "Pile order" — offered
      first, ahead of the orders every view shares. */
  defaultSort: Extra;
  /** Rendered after the sort select, for a control only one view has. */
  children?: React.ReactNode;
};

export default function Toolbar({ filters, genres, defaultSort, children }: Props) {
  const { q, status, genre, sort, setQ, setStatus, setGenre, setSort } = filters;
  const statusRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  return (
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
          entirely until there is something to filter on rather than offered as
          a select with one inert option. genresIn always returns "All" first,
          so a length of one means no subjects exist. */}
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
        <option value={defaultSort.value}>{defaultSort.label}</option>
        {COMMON_SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {children}
    </div>
  );
}
