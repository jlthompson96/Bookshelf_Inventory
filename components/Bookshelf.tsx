"use client";

import React, { useState, useMemo } from "react";
import type { Book } from "@/lib/notion";

/* Cloth colours tuned for a dark case. Each is a bookbinding tone rather than
   a UI hue, and each stays distinguishable at 14px of spine width. */
const CLOTH: Record<string, string> = {
  "Fantasy": "#B0793F",
  "Sci-Fi": "#4A90C4",
  "Classic Literature": "#8E8C82",
  "Historical Fiction": "#C46A90",
  "Mythology": "#C9A227",
  "Philosophical Fiction": "#5E9B84",
  "Gothic / Horror": "#8A6FB8",
  "Dystopian Fiction": "#A06FC4",
  "Mystery / Detective": "#4FA07A",
  "Epic Poetry": "#D98A4A",
  "Adventure": "#D0563C",
};

const FALLBACK = "#8E8C82";
const CASE = "#191B18";
const LINEN = "#E8E4D9";

const cloth = (b: Book) => CLOTH[b.g[0]] ?? FALLBACK;
const callNumber = (b: Book) => `${b.sh}\u00b7${String(b.p).padStart(2, "0")}`;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* Width and height stand in for thickness until real page counts exist.
   Add a Pages number property in Notion and both become proportional. */
function weight(b: Book) {
  if (b.pages) return Math.max(0.55, Math.min(2.2, b.pages / 320));
  return 0.8 + (hash(b.t) % 45) / 100;
}

function height(b: Book) {
  if (b.pages) return 140 + Math.min(60, Math.round(b.pages / 12));
  return 140 + (hash(b.a + b.t) % 58);
}

type Slot = { empty: true; p: number } | (Book & { empty?: false });

export default function Bookshelf({ books }: { books: Book[] }) {
  const [status, setStatus] = useState("All");
  const [genre, setGenre] = useState("All");
  const [selected, setSelected] = useState<Book | null>(null);

  const genres = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => b.g.forEach((g) => set.add(g)));
    return ["All", ...Array.from(set).sort()];
  }, [books]);

  const shelfNumbers = useMemo(
    () => Array.from(new Set(books.map((b) => b.sh))).sort((a, b) => a - b),
    [books]
  );

  const matches = (b: Book) =>
    (status === "All" || b.s === status) && (genre === "All" || b.g.includes(genre));

  const hits = books.filter(matches).length;
  const read = books.filter((b) => b.s === "Read").length;

  const chip = (active: boolean): React.CSSProperties => ({
    font: "500 11px/1 var(--font-mono), monospace",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "8px 14px",
    borderRadius: 1,
    cursor: "pointer",
    border: `1px solid ${active ? "var(--brass)" : "var(--rule)"}`,
    background: active ? "var(--brass)" : "transparent",
    color: active ? CASE : "var(--linen-dim)",
  });

  if (!books.length) {
    return (
      <main style={{ padding: "72px 28px", fontFamily: "var(--font-sans), sans-serif" }}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>Empty stacks</div>
        <h1 style={{ font: "400 34px/1.2 var(--font-display), Georgia, serif", margin: 0 }}>Nothing on the shelf</h1>
        <p style={{ font: "400 15px/1.7 var(--font-sans), sans-serif", color: "var(--linen-dim)" }}>
          Notion answered, but no rows came back carrying both a shelf number and a position.
        </p>
      </main>
    );
  }

  const stat = (value: number, label: string) => (
    <div key={label} style={{ paddingRight: 34 }}>
      <div style={{ font: "400 30px/1 var(--font-display), Georgia, serif", color: LINEN }}>{value}</div>
      <div className="eyebrow" style={{ marginTop: 8 }}>{label}</div>
    </div>
  );

  return (
    <main style={{ padding: "56px 32px 48px", fontFamily: "var(--font-sans), system-ui, sans-serif", maxWidth: 1320, margin: "0 auto" }}>
      <header style={{ marginBottom: 34 }}>
        <div className="eyebrow">Bookshelf inventory</div>
        <h1 style={{ font: "400 clamp(42px, 7vw, 68px)/1 var(--font-display), Georgia, serif", margin: "14px 0 0", color: LINEN }}>
          The shelf, as it stands
        </h1>
        <p style={{ font: "400 15px/1.7 var(--font-sans), sans-serif", color: "var(--linen-dim)", margin: "16px 0 0", maxWidth: 560 }}>
          Every volume in its real position, left to right. Cloth spines are read, hollow spines
          are waiting. The plate on each spine carries its shelf and position.
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", borderTop: "1px solid var(--rule)", borderBottom: "1px solid var(--rule)", padding: "22px 0", marginBottom: 30 }}>
        {stat(books.length, "Volumes")}
        {stat(read, "Read")}
        {stat(books.length - read, "Waiting")}
        {stat(hits, "In view")}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 42 }}>
        {["All", "Read", "Reading", "Unread"].map((s) => (
          <button key={s} onClick={() => setStatus(s)} style={chip(status === s)}>{s}</button>
        ))}
        <span style={{ width: 1, height: 24, background: "var(--rule)", margin: "0 8px" }} />
        <label htmlFor="genre" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Filter by subject</label>
        <select id="genre" value={genre} onChange={(e) => setGenre(e.target.value)} style={{ ...chip(genre !== "All"), padding: "8px 10px", textTransform: "none", letterSpacing: "0.04em" }}>
          {genres.map((g) => <option key={g} value={g} style={{ background: CASE, color: LINEN }}>{g}</option>)}
        </select>
      </div>

      {shelfNumbers.map((n) => {
        const shelfBooks = books.filter((b) => b.sh === n).sort((a, b) => a.p - b.p);
        const maxPos = Math.max(...shelfBooks.map((b) => b.p));
        const slots: Slot[] = [];
        for (let p = 1; p <= maxPos; p++) {
          const found = shelfBooks.find((b) => b.p === p);
          slots.push(found ?? { empty: true, p });
        }
        return (
          <section key={n} style={{ marginBottom: 46 }}>
            <div className="stacks">
              <div className="row">
                {slots.map((slot) =>
                  slot.empty ? (
                    <div
                      key={`empty-${n}-${slot.p}`}
                      title={`Position ${slot.p} has no record in Notion`}
                      style={{ flex: "1 0 0", minWidth: 0, height: 30, border: "1px dashed var(--rule)", borderBottom: "none" }}
                    />
                  ) : (
                    <a
                      key={slot.u}
                      href={slot.u}
                      target="_blank"
                      rel="noreferrer"
                      className="spine"
                      onMouseEnter={() => setSelected(slot)}
                      onFocus={() => setSelected(slot)}
                      title={`${slot.t} by ${slot.a}`}
                      style={{
                        flex: `${weight(slot)} 0 0`,
                        minWidth: 0,
                        height: height(slot),
                        background: matches(slot) && slot.s === "Read" ? cloth(slot) : "transparent",
                        border: `1px solid ${cloth(slot)}`,
                        borderBottom: "none",
                        color: slot.s === "Read" ? CASE : cloth(slot),
                        opacity: matches(slot) ? 1 : 0.14,
                        borderRadius: "2px 2px 0 0",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "stretch",
                        justifyContent: "space-between",
                        textDecoration: "none",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minHeight: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          font: "500 11px/1 var(--font-sans), sans-serif",
                          letterSpacing: "0.04em",
                          padding: "12px 0 8px",
                        }}
                      >
                        {slot.t}
                      </span>
                      <span
                        style={{
                          background: matches(slot) ? "rgba(232,228,217,0.92)" : "rgba(232,228,217,0.35)",
                          color: CASE,
                          font: "400 10px/1 var(--font-mono), monospace",
                          letterSpacing: "0.02em",
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "7px 0",
                          margin: "0 2px 6px",
                          borderRadius: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                        }}
                      >
                        {callNumber(slot)}
                      </span>
                    </a>
                  )
                )}
              </div>
            </div>
            <div className="board" />
            <div className="board-shadow" />
            <div className="eyebrow" style={{ marginTop: 8 }}>
              Shelf {n} &middot; {shelfBooks.length} volumes &middot; {shelfBooks.filter((b) => b.s === "Read").length} read
            </div>
          </section>
        );
      })}

      <div style={{ marginTop: 12, minHeight: 220 }}>
        {selected ? (
          <article
            className="card-rules"
            style={{
              background: LINEN,
              color: CASE,
              maxWidth: 560,
              padding: "26px 28px 30px",
              borderRadius: 2,
              borderLeft: `4px solid ${cloth(selected)}`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, font: "400 11px/1 var(--font-mono), monospace", letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b6960" }}>
              <span>{callNumber(selected)}</span>
              <span>{selected.s}</span>
            </div>
            <h2 style={{ font: "400 26px/1.25 var(--font-display), Georgia, serif", margin: "18px 0 0", color: CASE }}>
              {selected.t}
            </h2>
            <div style={{ font: "400 14px/1.6 var(--font-sans), sans-serif", color: "#4a4841", marginTop: 6 }}>{selected.a}</div>
            <div style={{ marginTop: 20, borderTop: "1px solid rgba(25,27,24,0.14)", paddingTop: 14 }}>
              <div style={{ font: "400 10px/1 var(--font-mono), monospace", letterSpacing: "0.14em", textTransform: "uppercase", color: "#8a8880" }}>
                Subject headings
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {selected.g.map((g) => (
                  <span key={g} style={{ font: "500 11px/1 var(--font-sans), sans-serif", padding: "6px 10px", border: `1px solid ${CLOTH[g] ?? FALLBACK}`, color: "#3a3831", borderRadius: 1 }}>{g}</span>
                ))}
              </div>
            </div>
            {selected.pages ? (
              <div style={{ font: "400 11px/1 var(--font-mono), monospace", color: "#8a8880", marginTop: 16, letterSpacing: "0.06em" }}>
                {selected.pages} pages
              </div>
            ) : null}
          </article>
        ) : (
          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 18 }}>
            <div className="eyebrow">Catalog card</div>
            <p style={{ font: "400 14px/1.6 var(--font-sans), sans-serif", color: "var(--linen-faint)", marginTop: 10 }}>
              Hover a spine to pull its card.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
