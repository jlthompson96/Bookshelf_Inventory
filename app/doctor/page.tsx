import { getAudit, getSchema, NotionError, SHELF, CHEST, type FailureKind } from "@/lib/notion";
import { runAudit, type Finding, type Severity } from "@/lib/audit";
import NotionFailure from "@/components/NotionFailure";
import CatalogueCheck from "@/components/CatalogueCheck";
import styles from "./doctor.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shelf doctor",
  description: "What the app is being quietly forgiving about, and who that forgiveness costs.",
};

/* Named for consequence, not for colour — a finding's word is what carries its
   severity, so nothing here depends on a hue to be understood (WCAG 1.4.1). */
const SEVERITY_LABEL: Record<Severity, string> = {
  dropped: "Dropped",
  wrong: "Drawn wrong",
  review: "Worth a look",
};

const SEVERITY_HINT: Record<Severity, string> = {
  dropped: "Not rendered anywhere in the app.",
  wrong: "Rendered, but incorrectly.",
  review: "Rendered fine, but probably not intended.",
};

/* What ran, named for the clean-state page — the one that has nothing else to
   show and needs to say what it actually checked instead. */
const CHECKS_RUN = [
  "Optional schema — whether Pages, Rating and Date Finished are defined in either database",
  "Rows toBook drops for a missing title, or a missing Shelf # / position on the shelf",
  "Two books claiming the same shelf or pile position",
  "Chest rows with a pile but no position, or a position but no pile",
  "Genres in use with no cloth colour, and books with no genre at all",
  "Books with no author on file",
  "The same title present on both the shelf and in the chest",
  "Runs of five or more empty slots in a row on one shelf",
];

export default async function DoctorPage() {
  let shelf: Awaited<ReturnType<typeof getAudit>>["shelf"] = [];
  let chest: Awaited<ReturnType<typeof getAudit>>["chest"] = [];
  let rejected: Awaited<ReturnType<typeof getAudit>>["rejected"] = [];
  let findings: Finding[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    const [audit, shelfSchema, chestSchema] = await Promise.all([
      getAudit(),
      getSchema(SHELF),
      getSchema(CHEST),
    ]);
    shelf = audit.shelf;
    chest = audit.chest;
    rejected = audit.rejected;
    findings = runAudit({ shelf, chest, rejected, shelfSchema, chestSchema });
  } catch (err) {
    if (err instanceof NotionError) {
      kind = err.kind;
      detail = err.detail;
    } else {
      kind = "unknown";
      detail = err instanceof Error ? err.message : String(err);
    }
  }

  if (kind) return <NotionFailure kind={kind} detail={detail} />;

  const catalogueBooks = [...shelf, ...chest].map((b) => ({ id: b.id, t: b.t, a: b.a, u: b.u }));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>Shelf doctor</h1>
        <p className={styles.lede}>
          Every view in this app is deliberately forgiving of a messy Notion row — a
          missing title is skipped rather than crashing the page, an unrecognised genre
          falls back to a plain grey rather than an error. That forgiveness is invisible
          from inside the app. This page is the other side of it: what got quietly
          skipped, drawn wrong, or is probably a mistake, with a link to the Notion row
          that fixes it.
        </p>
        <p className={styles.footnote}>
          Read-only. Nothing here writes to Notion, and nothing here is behind{" "}
          <code className={styles.code}>BOOKSHELF_WRITE_ENABLED</code> — it only reads what{" "}
          <code className={styles.code}>/api/books</code> already exposes.
        </p>
      </header>

      {findings.length === 0 ? (
        <section className={styles.clean}>
          <p className={styles.cleanTitle}>Nothing to fix.</p>
          <p className={styles.body}>
            {shelf.length + chest.length} books checked across the shelf and the chest.
            Checks run:
          </p>
          <ul className={styles.checklist}>
            {CHECKS_RUN.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-labelledby="findings">
          <h2 id="findings" className={styles.sectionTitle}>
            {findings.length} finding{findings.length === 1 ? "" : "s"}
          </h2>
          <ul className={styles.findings}>
            {findings.map((f) => (
              <li key={f.key} className={styles.finding} data-severity={f.severity}>
                <details open={f.items.length <= 8}>
                  <summary className={styles.findingSummary}>
                    <span className={styles.badge} data-severity={f.severity}>
                      {SEVERITY_LABEL[f.severity]}
                    </span>
                    <span className={styles.findingText}>{f.summary}</span>
                  </summary>
                  <div className={styles.findingBody}>
                    <p className={styles.consequence}>
                      <span className={styles.severityHint}>{SEVERITY_HINT[f.severity]}</span>{" "}
                      {f.consequence}
                    </p>
                    {f.items.length ? (
                      <ul className={styles.items}>
                        {f.items.map((item, i) => (
                          <li key={item.id ? `${item.id}-${i}` : `${item.label}-${i}`}>
                            {item.id ? (
                              <a className={styles.itemLink} href={`/book/${item.id}`}>
                                {item.label}
                              </a>
                            ) : (
                              <span>{item.label}</span>
                            )}
                            {item.url ? (
                              <a className={styles.notionLink} href={item.url} target="_blank" rel="noreferrer">
                                Notion ↗
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="catalogue" className={styles.section}>
        <h2 id="catalogue" className={styles.sectionTitle}>
          Catalogue matches
        </h2>
        <p className={styles.body}>
          Separate from everything above, and not run automatically: which books neither
          Open Library nor Google Books can match — the ones that will show a cloth
          binding instead of a cover in the gallery. Checking the whole collection is{" "}
          {Math.ceil(catalogueBooks.length / 24)} requests to the same batched endpoint the
          gallery uses, so it runs on demand rather than on every page load.
        </p>
        <CatalogueCheck books={catalogueBooks} />
      </section>
    </main>
  );
}
