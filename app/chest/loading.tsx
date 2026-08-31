import styles from "@/components/Chest.module.css";

/* Widths and thicknesses are fixed rather than random so the server and client
   markup agree. A skeleton shaped like a pile reads as "a chest is loading" and
   keeps the metaphor intact during the two Notion round trips. */
const PILES = [
  [
    [148, 22],
    [176, 17],
    [162, 26],
    [190, 19],
    [155, 15],
  ],
  [
    [171, 18],
    [143, 24],
    [186, 16],
    [159, 21],
  ],
  [
    [165, 20],
    [181, 15],
    [150, 25],
    [174, 18],
    [158, 22],
    [168, 16],
  ],
];

export default function Loading() {
  return (
    <main className={styles.page}>
      <p className="eyebrow">Storage chest</p>
      <h1 className={styles.title}>The overflow, in piles</h1>
      <p className="eyebrow" role="status" style={{ marginTop: "2rem" }}>
        Pulling the chest from Notion&hellip;
      </p>
      <div style={{ marginTop: "2.5rem" }} aria-hidden="true">
        <div className={styles.chest}>
          {PILES.map((pile, p) => (
            <section key={p} className={styles.pile}>
              <div className={styles.pileBooks}>
                {pile.map(([w, h], i) => (
                  <div
                    key={i}
                    className="skeleton-slab"
                    style={{
                      width: w,
                      height: h,
                      animationDelay: `${((i + p) % 6) * 90}ms`,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        <div className={styles.floor} />
      </div>
    </main>
  );
}
