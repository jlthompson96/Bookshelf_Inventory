import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBooks, getChestBooks, type ChestBook } from "@/lib/notion";
import { bookHref } from "@/lib/href";
import { formatFinished } from "@/lib/dates";
import { MONTHS, readingYear, yearsWithFinishes } from "@/lib/stats";
import { callNumber, cloth } from "@/lib/spine";
import { LabelledBars, MonthBars } from "@/components/Bars";
import styles from "../stats.module.css";

export const dynamic = "force-dynamic";

/* Wide enough to cover a Notion date, narrow enough that /stats/99999 is a 404
   rather than a Notion round trip. */
const isYear = (s: string) => /^\d{4}$/.test(s) && Number(s) >= 1900 && Number(s) <= 2200;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ year: string }>;
}): Promise<Metadata> {
  const { year } = await params;
  if (!isYear(year)) return { title: "Not a year" };
  return {
    title: `${year} in reading`,
    description: `Every book finished in ${year}, from the Bookshelf Inventory.`,
    openGraph: { title: `${year} in reading`, type: "article" },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ReadingYearPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year: raw } = await params;
  if (!isYear(raw)) notFound();
  const year = Number(raw);

  const [shelf, chest] = await Promise.all([getBooks(), getChestBooks()]);
  const y = readingYear(shelf, chest, year);
  const years = yearsWithFinishes([...shelf, ...chest]);

  const prev = years.find((n) => n < year);
  const next = [...years].reverse().find((n) => n > year);

  const entry = (b: ChestBook) => (
    <li key={b.id}>
      <Link
        className={styles.entry}
        style={{ "--cloth": cloth(b) } as React.CSSProperties}
        href={bookHref(b)}
      >
        <span className={styles.entryTitle}>{b.t}</span>
        <span className={styles.entryAuthor}>{b.a}</span>
        <span className={styles.entryMeta}>
          {b.finished ? <span>{formatFinished(b.finished)}</span> : null}
          {callNumber(b) ? <span>{callNumber(b)}</span> : null}
          {b.rating ? <span aria-label={`${b.rating} out of 5`}>{"★".repeat(b.rating)}</span> : null}
        </span>
      </Link>
    </li>
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={`eyebrow ${styles.back}`} href="/stats">
          &larr; Statistics
        </Link>
        <h1 className={styles.title}>{year} in reading</h1>
        {y.books.length ? (
          <p className={styles.lede}>
            {y.books.length} {y.books.length === 1 ? "book" : "books"} finished
            {y.busiest ? `, most of them in ${y.busiest.month}` : ""}.
          </p>
        ) : (
          <p className={styles.lede}>
            No book in the inventory carries a finish date in {year}.
          </p>
        )}
      </header>

      {/* The coverage line, always. Every figure on this page counts only the
          books that carry a Date Finished, and stating the denominator is what
          keeps a thin year from reading as a quiet one. */}
      <p className={styles.coverage}>
        Counted from the {y.coverage.dated}{" "}
        {y.coverage.dated === 1 ? "book that carries" : "books that carry"} a finish date in{" "}
        {year}, out of {y.coverage.read} marked Read across the whole inventory.
        {y.coverage.withPages < y.coverage.dated
          ? ` ${y.coverage.withPages} of them record a page count.`
          : ""}
      </p>

      {y.books.length ? (
        <>
          <dl className={styles.stats}>
            {[
              [y.books.length, "Finished"],
              [y.authors, "Authors"],
              [y.subjects.length, "Subjects"],
              ...(y.pages ? [[y.pages.toLocaleString("en-US"), "Pages"] as const] : []),
              ...(y.averageLength ? [[y.averageLength, "Average length"] as const] : []),
              ...(y.rating ? [[y.rating, "Average rating"] as const] : []),
            ].map(([value, name]) => (
              <div key={name as string} className={styles.stat}>
                <dt className={`eyebrow ${styles.statLabel}`}>{name}</dt>
                <dd className={styles.statValue}>{value}</dd>
              </div>
            ))}
          </dl>

          <section className={styles.section}>
            <MonthBars counts={y.byMonth} months={MONTHS} />
          </section>

          {y.subjects.length ? (
            <section className={styles.section} aria-labelledby="year-subjects">
              <h2 id="year-subjects" className={styles.sectionTitle}>
                What the year was made of
              </h2>
              <LabelledBars data={y.subjects} caption={`Books finished in ${year}, by subject`} colorByName />
            </section>
          ) : null}

          <section className={styles.section} aria-labelledby="year-list">
            <h2 id="year-list" className={styles.sectionTitle}>
              Everything finished in {year}
            </h2>
            <ul className={styles.entries}>{y.books.map(entry)}</ul>
          </section>
        </>
      ) : (
        <div className={styles.note}>
          <p className={styles.body}>
            This is not necessarily a year with no reading in it — it is a year with no
            recorded finish dates. The inventory holds {y.coverage.read} books marked
            Read; the ones finished in {year} can only appear here once the{" "}
            <code className={styles.code}>Date Finished</code> property in Notion is filled
            in for them.
          </p>
        </div>
      )}

      <nav className={styles.yearNav} aria-label="Other reading years">
        {prev ? (
          <Link className={styles.year} href={`/stats/${prev}`}>
            &larr; {prev}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link className={styles.year} href={`/stats/${next}`}>
            {next} &rarr;
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
