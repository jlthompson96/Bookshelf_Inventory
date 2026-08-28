import styles from "@/components/Bookshelf.module.css";

/* Heights are fixed rather than random so the server and client markup agree.
   A skeleton shaped like a shelf reads as "a bookshelf is loading" and keeps
   the metaphor intact during the two Notion round trips. */
const HEIGHTS = [168, 191, 152, 178, 160, 199, 145, 183, 171, 156, 188, 164];

function SkeletonShelf({ n }: { n: number }) {
  return (
    <section className={styles.shelf} aria-hidden="true">
      <div className="skeleton-row">
        {HEIGHTS.map((h, i) => (
          <div
            key={i}
            className="skeleton-spine"
            style={{ height: h, animationDelay: `${((i + n) % 6) * 90}ms` }}
          />
        ))}
      </div>
      <div className={styles.board} />
    </section>
  );
}

export default function Loading() {
  return (
    <main className={styles.page}>
      <p className="eyebrow">Bookshelf inventory</p>
      <h1 className={styles.title}>The shelf, as it stands</h1>
      <p className="eyebrow" role="status" style={{ marginTop: "2rem" }}>
        Pulling the catalog from Notion&hellip;
      </p>
      <div style={{ marginTop: "2.5rem" }}>
        {[0, 1, 2].map((n) => (
          <SkeletonShelf key={n} n={n} />
        ))}
      </div>
    </main>
  );
}
