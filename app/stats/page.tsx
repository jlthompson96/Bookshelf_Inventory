import Link from "next/link";
import { getBooks, getChestBooks, NotionError, type ChestBook, type FailureKind } from "@/lib/notion";
import { collection, yearsWithFinishes } from "@/lib/stats";
import { LabelledBars } from "@/components/Bars";
import NotionFailure from "@/components/NotionFailure";
import styles from "./stats.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Statistics",
  description: "What the inventory adds up to: the collection, and the reading years in it.",
};

export default async function StatsPage() {
  let shelf: ChestBook[] = [];
  let chest: ChestBook[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    [shelf, chest] = await Promise.all([getBooks(), getChestBooks()]);
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

  const all = [...shelf, ...chest];
  const c = collection(all);
  const years = yearsWithFinishes(all);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className="eyebrow">Bookshelf inventory</p>
        <h1 className={styles.title}>The collection, counted</h1>
        <p className={styles.lede}>
          Everything on the shelf and in the chest, added up. The reading years below are
          drawn from the date each book was finished.
        </p>
      </header>

      <dl className={styles.stats}>
        {[
          [c.total, "Volumes"],
          [c.read, "Read"],
          [c.reading, "Reading"],
          [c.unread, "Waiting"],
          [c.authors, "Authors"],
          [c.subjects.length, "Subjects"],
        ].map(([value, name]) => (
          <div key={name as string} className={styles.stat}>
            <dt className={`eyebrow ${styles.statLabel}`}>{name}</dt>
            <dd className={styles.statValue}>{value}</dd>
          </div>
        ))}
      </dl>

      <section className={styles.section} aria-labelledby="years">
        <h2 id="years" className={styles.sectionTitle}>
          The reading year
        </h2>

        {years.length ? (
          <>
            <p className={styles.body}>
              {c.has.finished} of the {c.read} books marked Read carry a finish date.
            </p>
            <ul className={styles.years}>
              {years.map((y) => (
                <li key={y}>
                  <Link className={styles.year} href={`/stats/${y}`}>
                    {y}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          /* The honest empty state, and the current one: neither database
             defines Date Finished, so there is no reading year to show. Saying
             what to add is more use than an empty chart. */
          <div className={styles.note}>
            <p className={styles.body}>
              Nothing to show yet. {c.read} books are marked Read, but none carries a
              finish date, so there is no way to know which year to count it in.
            </p>
            <p className={styles.body}>
              Add a <code className={styles.code}>Date Finished</code> date property to the
              Books database in Notion and fill it in. The reading year appears on its own
              as soon as one book has a date, and the same property turns on the
              &ldquo;Recently finished&rdquo; sort the shelf already offers.
            </p>
            <p className={styles.body}>
              <code className={styles.code}>Pages</code> and{" "}
              <code className={styles.code}>Rating</code> are read the same way and are
              also absent, which is why there is no page count or average rating above.
            </p>
          </div>
        )}
      </section>

      <div className={styles.charts}>
        <section aria-labelledby="subjects">
          <h2 id="subjects" className={styles.sectionTitle}>
            By subject
          </h2>
          <LabelledBars data={c.subjects} caption="Volumes per subject" colorByName />
        </section>

        <section aria-labelledby="shelves">
          <h2 id="shelves" className={styles.sectionTitle}>
            By shelf
          </h2>
          <LabelledBars
            data={c.shelves.map((s) => ({ ...s, name: `Shelf ${s.name}` }))}
            caption="Volumes per shelf"
          />
          <p className={styles.footnote}>
            Shelf numbers are shared between the two databases, so a shelf here counts the
            chest&rsquo;s pile of the same number alongside it.
          </p>
        </section>
      </div>
    </main>
  );
}
