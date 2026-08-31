/**
 * The shelf doctor's free checks — everything /doctor can say without an extra
 * network round trip beyond the Notion reads the shelf and chest already make.
 *
 * Every check answers the same question from a different angle: what is this
 * app being quietly forgiving about, and who does that forgiveness cost? A
 * dropped row, a wrong colour and a probably-a-mistake row are three different
 * kinds of problem, so severity carries the distinction rather than colour —
 * "dropped" is invisible today, "wrong" renders but renders incorrectly,
 * "review" renders fine but is very likely not what was intended.
 *
 * Nothing here calls Notion. It takes the same shelf, chest, schema and reject
 * list the doctor page already fetched, so the checks stay pure and testable
 * without a token.
 */

import { fold } from "./bookinfo";
import type { Book, ChestBook, Reject, Schema } from "./notion";
import { isKnownGenre } from "./spine";
import { shelfNumbers, slotsFor } from "./shelf";

export type Severity = "dropped" | "wrong" | "review";

/** One occurrence inside a finding: a book, or — for a gap — a labelled range. */
export type FindingItem = {
  /** The book's own page, for a /book/<id> link. Absent for a range finding. */
  id?: string;
  /** The Notion page, for "fix it here". Absent only when there is no page —
      a range has none of its own. */
  url?: string;
  label: string;
};

export type Finding = {
  key: string;
  severity: Severity;
  /** What is true, as a count or a name. */
  summary: string;
  /** What the app does about it today, in one sentence. */
  consequence: string;
  items: FindingItem[];
};

const SEVERITY_ORDER: Record<Severity, number> = { dropped: 0, wrong: 1, review: 2 };
export const bySeverity = (a: Finding, b: Finding) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];

const bookItem = (b: { id: string; u: string; t: string }): FindingItem => ({
  id: b.id,
  url: b.u,
  label: b.t,
});

/* --- tier 1: schema -------------------------------------------------------- */

const WHY: Record<"pages" | "rating" | "finished", { property: string; consequence: string }> = {
  pages: {
    property: "Pages",
    consequence:
      "Every spine's thickness and height falls back to a deterministic hash of the title, rather than the real proportions of the book.",
  },
  rating: {
    property: "Rating",
    consequence: '"Highest rated" sorts nothing, and no catalog card shows a rating.',
  },
  finished: {
    property: "Date Finished",
    consequence: "/stats has no reading year to show, for any year.",
  },
};

/** One finding per optional property missing from either database. */
export function auditSchema(shelfSchema: Schema, chestSchema: Schema): Finding[] {
  const findings: Finding[] = [];
  for (const key of Object.keys(WHY) as (keyof typeof WHY)[]) {
    const missingFrom: string[] = [];
    if (!shelfSchema.has[key]) missingFrom.push("Books");
    if (!chestSchema.has[key]) missingFrom.push("Storage Chest Books");
    if (!missingFrom.length) continue;

    const { property, consequence } = WHY[key];
    findings.push({
      key: `schema-${key}`,
      severity: key === "pages" ? "wrong" : "review",
      summary: `${property} is not defined in ${missingFrom.join(" or ")}.`,
      consequence,
      items: [],
    });
  }
  return findings;
}

/* --- tier 2: rows ------------------------------------------------------- */

/** Rows toBook dropped entirely — invisible everywhere, not just on the shelf. */
export function auditRejections(rejected: Reject[]): Finding[] {
  const findings: Finding[] = [];

  const untitled = rejected.filter((r) => r.why === "no-title");
  if (untitled.length) {
    findings.push({
      key: "rejected-no-title",
      severity: "dropped",
      summary: `${untitled.length} row${untitled.length === 1 ? "" : "s"} ${untitled.length === 1 ? "has" : "have"} no title.`,
      consequence: "Skipped everywhere — the shelf, the chest, and this list all have nothing to show for it but the Notion link.",
      items: untitled.map((r) => ({ url: r.url, label: r.url })),
    });
  }

  const unplacedShelf = rejected.filter((r) => r.why === "no-group" || r.why === "no-position");
  if (unplacedShelf.length) {
    findings.push({
      key: "rejected-unplaced-shelf",
      severity: "dropped",
      summary: `${unplacedShelf.length} shelf row${unplacedShelf.length === 1 ? "" : "s"} ${unplacedShelf.length === 1 ? "is" : "are"} missing a Shelf # or a position.`,
      consequence: "Dropped from the shelf entirely — a chest row in the same state is kept and listed as not yet placed, but a shelf row has nowhere to draw.",
      items: unplacedShelf.map((r) => ({ url: r.url, label: r.title ?? r.url })),
    });
  }

  return findings;
}

/** Two rows claiming the same group and position — can only happen editing Notion directly, since the write path refuses the collision with a 409. */
function auditCollisions(
  books: (Book | ChestBook)[],
  unitLabel: "shelf" | "pile",
  numberWord: "Shelf" | "Stack",
  key: string,
  consequence: string
): Finding | null {
  const byKey = new Map<string, (Book | ChestBook)[]>();
  for (const b of books) {
    if (b.sh == null || b.p == null) continue;
    const k = `${b.sh}:${b.p}`;
    byKey.set(k, [...(byKey.get(k) ?? []), b]);
  }

  const collisions = [...byKey.entries()].filter(([, group]) => group.length > 1);
  if (!collisions.length) return null;

  return {
    key,
    severity: "wrong",
    summary: `${collisions.length} ${unitLabel} position${collisions.length === 1 ? "" : "s"} ${collisions.length === 1 ? "is" : "are"} claimed by more than one book.`,
    consequence,
    items: collisions.flatMap(([k, group]) => {
      const [sh, p] = k.split(":");
      return group.map((b) => ({ id: b.id, url: b.u, label: `${b.t} — ${numberWord} ${sh}, position ${p}` }));
    }),
  };
}

export function auditShelfCollisions(shelf: Book[]): Finding[] {
  const f = auditCollisions(
    shelf,
    "shelf",
    "Shelf",
    "collision-shelf",
    "Only one of the two draws — the shelf view finds the first match and the other is silently absent from its own slot."
  );
  return f ? [f] : [];
}

export function auditChestCollisions(chest: ChestBook[]): Finding[] {
  const f = auditCollisions(
    chest,
    "pile",
    "Stack",
    "collision-chest",
    "Both books draw at the same spot in the pile, overlapping rather than stacking."
  );
  return f ? [f] : [];
}

/** A chest row with a pile but no position, or vice versa — already listed under "Not yet placed" on /chest; counted here so it shows up without a separate trip. */
export function auditChestUnplaced(chest: ChestBook[]): Finding[] {
  const unplaced = chest.filter((b) => b.sh == null || b.p == null);
  if (!unplaced.length) return [];
  return [
    {
      key: "chest-unplaced",
      severity: "review",
      summary: `${unplaced.length} chest row${unplaced.length === 1 ? "" : "s"} ${unplaced.length === 1 ? "has" : "have"} no pile, no position, or neither.`,
      consequence: '/chest keeps these under "Not yet placed" rather than dropping them — this is that same list, for reference.',
      items: unplaced.map(bookItem),
    },
  ];
}

/** A genre a book carries that lib/spine.ts has no cloth colour for. */
export function auditGenres(all: ChestBook[]): Finding[] {
  const findings: Finding[] = [];

  const byUnknownGenre = new Map<string, ChestBook[]>();
  for (const b of all) {
    for (const g of b.g) {
      if (!isKnownGenre(g)) byUnknownGenre.set(g, [...(byUnknownGenre.get(g) ?? []), b]);
    }
  }
  if (byUnknownGenre.size) {
    const names = [...byUnknownGenre.keys()].sort();
    findings.push({
      key: "genre-unmapped",
      severity: "wrong",
      summary: `${names.length} subject${names.length === 1 ? "" : "s"} in use ${names.length === 1 ? "has" : "have"} no cloth colour: ${names.join(", ")}.`,
      consequence: "Renders in the same fallback grey as Classic Literature — indistinguishable from it on the shelf and in the /stats charts.",
      items: [...byUnknownGenre.entries()].flatMap(([g, books]) =>
        books.map((b) => ({ id: b.id, url: b.u, label: `${b.t} — ${g}` }))
      ),
    });
  }

  const noGenre = all.filter((b) => b.g.length === 0);
  if (noGenre.length) {
    findings.push({
      key: "genre-missing",
      severity: "wrong",
      summary: `${noGenre.length} book${noGenre.length === 1 ? "" : "s"} ${noGenre.length === 1 ? "has" : "have"} no subject at all.`,
      consequence: "Same fallback grey as an unmapped genre, for the same reason: there is no first genre to look a colour up by.",
      items: noGenre.map(bookItem),
    });
  }

  return findings;
}

/** Author left blank — toBook's "Unknown" default, which is worse than a missing byline: it also guarantees the catalogue lookup misses. */
export function auditAuthors(all: ChestBook[]): Finding[] {
  const unknown = all.filter((b) => b.a === "Unknown");
  if (!unknown.length) return [];
  return [
    {
      key: "author-unknown",
      severity: "wrong",
      summary: `${unknown.length} book${unknown.length === 1 ? "" : "s"} ${unknown.length === 1 ? "has" : "have"} no author.`,
      consequence: 'The catalog card shows "Unknown", and the catalogue lookup always misses — a blank author can never match a candidate\'s surname, so the cover, blurb and ISBN are never filled in.',
      items: unknown.map(bookItem),
    },
  ];
}

/** The same title on the shelf and in the chest — usually a move that never got the old row deleted. */
export function auditDuplicateTitles(shelf: Book[], chest: ChestBook[]): Finding[] {
  const shelfByFold = new Map<string, Book>();
  for (const b of shelf) shelfByFold.set(fold(b.t), b);

  const pairs: { shelfBook: Book; chestBook: ChestBook }[] = [];
  for (const c of chest) {
    const match = shelfByFold.get(fold(c.t));
    if (match) pairs.push({ shelfBook: match, chestBook: c });
  }
  if (!pairs.length) return [];

  return [
    {
      key: "duplicate-title",
      severity: "review",
      summary: `${pairs.length} title${pairs.length === 1 ? "" : "s"} ${pairs.length === 1 ? "appears" : "appear"} in both the shelf and the chest.`,
      consequence: "Both rows render — on the shelf and in the chest — as if they were two different copies. Often the sign of a move that never removed the old row.",
      items: pairs.flatMap(({ shelfBook, chestBook }) => [
        { id: shelfBook.id, url: shelfBook.u, label: `${shelfBook.t} — on the shelf` },
        { id: chestBook.id, url: chestBook.u, label: `${chestBook.t} — in the chest` },
      ]),
    },
  ];
}

/** A run of empty slots long enough to look like a typo rather than a book out on loan. */
const GAP_THRESHOLD = 5;

export function auditGaps(shelf: Book[]): Finding[] {
  const items: FindingItem[] = [];

  for (const shelfNo of shelfNumbers(shelf)) {
    let run: number[] = [];

    const flush = () => {
      if (run.length >= GAP_THRESHOLD) {
        const label =
          run.length === 1
            ? `Shelf ${shelfNo}, position ${run[0]}`
            : `Shelf ${shelfNo}, positions ${run[0]}–${run[run.length - 1]}`;
        items.push({ label });
      }
      run = [];
    };

    for (const slot of slotsFor(shelf, shelfNo)) {
      if (slot.empty) run.push(slot.p);
      else flush();
    }
    flush();
  }

  if (!items.length) return [];
  return [
    {
      key: "gap-run",
      severity: "review",
      summary: `${items.length} shelf gap${items.length === 1 ? "" : "s"} of ${GAP_THRESHOLD} or more empty slots in a row.`,
      consequence: "Drawn as empty blocks, same as a gap of one — indistinguishable on the shelf from a book that is merely out on loan, but this long a run is more often a typo in a position number.",
      items,
    },
  ];
}

/** Every free check, run and ordered by severity. */
export function runAudit(input: {
  shelf: Book[];
  chest: ChestBook[];
  rejected: Reject[];
  shelfSchema: Schema;
  chestSchema: Schema;
}): Finding[] {
  const { shelf, chest, rejected, shelfSchema, chestSchema } = input;
  const all = [...shelf, ...chest];

  return [
    ...auditSchema(shelfSchema, chestSchema),
    ...auditRejections(rejected),
    ...auditShelfCollisions(shelf),
    ...auditChestCollisions(chest),
    ...auditGenres(all),
    ...auditAuthors(all),
    ...auditDuplicateTitles(shelf, chest),
    ...auditChestUnplaced(chest),
    ...auditGaps(shelf),
  ].sort(bySeverity);
}
