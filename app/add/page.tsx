import { getBooks, getSchema, type Book, type Schema } from "@/lib/notion";
import { writesEnabled } from "@/lib/auth";
import AddBook from "@/components/AddBook";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shelve a book",
  robots: { index: false, follow: false },
};

export default async function AddPage() {
  /* The same switch the endpoint enforces, read here so the page explains
     itself rather than letting the form fail on submit. */
  if (!writesEnabled()) {
    return (
      <main className={styles.page}>
        <p className="eyebrow">Circulation desk</p>
        <h1 className={styles.title}>Shelving is switched off</h1>
        <p className={styles.lead}>
          This deployment can read the catalogue but not write to it. Writes are opt-in so
          that a deployment without Vercel Authentication in front of it cannot quietly
          expose a public write endpoint on a personal database.
        </p>
        <ol className={styles.steps}>
          <li>
            Turn on Vercel Authentication for this project under Settings, Deployment
            Protection. It cannot be scoped to one route, so it will also gate the public
            shelf and any Notion embed of it.
          </li>
          <li>Set BOOKSHELF_WRITE_ENABLED to true under Settings, Environment Variables.</li>
          <li>Redeploy, since a build that finished earlier will not pick the variable up.</li>
        </ol>
      </main>
    );
  }

  let books: Book[] = [];
  let schema: Schema = {
    statuses: [],
    shelves: [],
    genres: [],
    ratings: [],
    locations: [],
    has: { pages: false, rating: false, finished: false, location: false },
  };
  let detail = "";

  try {
    [books, schema] = await Promise.all([getBooks(), getSchema()]);
  } catch (err) {
    detail = err instanceof Error ? err.message : String(err);
  }

  /* Without the schema the form cannot offer a valid Status or a real shelf, so
     it would only produce writes Notion rejects. The shelf page already
     diagnoses every Notion failure in detail; this points at it rather than
     restating it. */
  if (detail) {
    return (
      <main className={styles.page}>
        <p className="eyebrow">Circulation desk</p>
        <h1 className={styles.title}>Notion is not answering</h1>
        <p className={styles.lead}>
          The shelf could not be read, so there is no way to know which shelves and statuses
          exist. Open the shelf itself for the full diagnosis.
        </p>
        <details className={styles.details}>
          <summary className={`eyebrow ${styles.summary}`}>Raw response</summary>
          <pre className={styles.raw}>{detail}</pre>
        </details>
      </main>
    );
  }

  return <AddBook books={books} schema={schema} />;
}
