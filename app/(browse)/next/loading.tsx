import styles from "@/components/ReadNext.module.css";

/* The shared (browse) loading state is a skeleton shelf, which would read as
   the wrong page here. This one is shaped like the picker: the mode switch, and
   a single suggestion card waiting to be filled in. */
export default function Loading() {
  return (
    <main className={styles.page}>
      <p className="eyebrow">Bookshelf inventory</p>
      <h1 className={styles.title}>What to read next</h1>
      <p className="eyebrow" role="status" style={{ marginTop: "2rem" }}>
        Pulling the pile from Notion&hellip;
      </p>
      <div className={styles.stage} style={{ marginTop: "2.5rem" }} aria-hidden="true">
        <div className="skeleton-slab" style={{ width: "100%", height: 150 }} />
      </div>
    </main>
  );
}
