import React from "react";
import type { Tally } from "@/lib/stats";
import { clothFor } from "@/lib/spine";
import styles from "./Bars.module.css";

/**
 * Two bar charts, both drawn as HTML rather than SVG — a bar is a box of a given
 * width, and a div does that natively with real text in it, which an SVG would
 * have to reimplement to stay selectable and legible at any zoom.
 *
 * Colour never carries the meaning in either. The cloth palette is the app's
 * identity for a subject, and it is used here for continuity, but it does not
 * survive as a chart palette: run it through a CVD check and Dystopian Fiction
 * against Gothic / Horror comes out at ΔE 1.8 for a deuteranope — and 4.2 for
 * normal vision, which is to say most readers cannot tell those two apart
 * either. So every bar is named on its own row and the length is the encoding.
 * A legend keyed on these colours would not be readable and is never used.
 */

export function LabelledBars({
  data,
  caption,
  colorByName = false,
  max: given,
}: {
  data: Tally[];
  caption: string;
  /** Cloth colours, for subjects. Decorative — the row label is the identity. */
  colorByName?: boolean;
  max?: number;
}) {
  if (!data.length) return null;
  const max = given ?? Math.max(...data.map((d) => d.count));

  return (
    <figure className={styles.figure}>
      <figcaption className={`eyebrow ${styles.caption}`}>{caption}</figcaption>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.name} className={styles.row}>
              <th scope="row" className={styles.name}>
                {d.name}
              </th>
              <td className={styles.track}>
                <span
                  className={styles.bar}
                  style={{
                    width: `${max ? (d.count / max) * 100 : 0}%`,
                    background: colorByName ? clothFor(d.name) : "var(--walnut)",
                  }}
                />
              </td>
              <td className={styles.value}>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * The twelve months of a reading year. Vertical, because a year is read left to
 * right, and flat-coloured: the height already encodes the count, and shading it
 * by the same number as well would be saying it twice.
 */
export function MonthBars({ counts, months }: { counts: number[]; months: string[] }) {
  const max = Math.max(1, ...counts);

  return (
    <figure className={styles.figure}>
      <figcaption className={`eyebrow ${styles.caption}`}>Finished by month</figcaption>
      <div className={styles.months} role="presentation">
        {counts.map((n, i) => (
          <div key={months[i]} className={styles.month}>
            {/* Only the months with something in them are labelled: a zero over
                every empty column is eleven numbers saying nothing. */}
            <span className={styles.monthValue} data-zero={n === 0}>
              {n || ""}
            </span>
            <span className={styles.monthTrack}>
              <span
                className={styles.monthBar}
                style={{ height: `${(n / max) * 100}%` }}
                data-zero={n === 0}
              />
            </span>
            <span className={styles.monthName}>{months[i]}</span>
          </div>
        ))}
      </div>
      {/* The chart is decorative to a screen reader; this is the actual data. */}
      <table className="visually-hidden">
        <caption>Books finished by month</caption>
        <tbody>
          {counts.map((n, i) => (
            <tr key={months[i]}>
              <th scope="row">{months[i]}</th>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
