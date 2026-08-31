import { ImageResponse } from "next/og";
import { getBooks, getChestBooks } from "@/lib/notion";
import { MONTHS, readingYear } from "@/lib/stats";
import { GRAIN, INK, INK_2, INK_3, PAPER, RULE, SIZE, WALNUT, eyebrow, fonts } from "@/app/_og/card";

export const alt = "A reading year from the Bookshelf Inventory";
export const size = SIZE;
export const contentType = "image/png";

/**
 * The year as a share card: the headline count, and the twelve months as bars.
 *
 * The bars are flat rather than shaded by their own value — the height already
 * says how many, and colouring by the same number would only say it twice. A
 * month with nothing in it keeps a hairline floor so the axis still reads as
 * twelve months. See app/_og/card.tsx for the satori constraints.
 */
export default async function Image({ params }: { params: Promise<{ year: string }> }) {
  const { year: raw } = await params;
  const year = Number(raw);

  const [shelf, chest] = await Promise.all([getBooks(), getChestBooks()]);
  const y = readingYear(shelf, chest, Number.isFinite(year) ? year : 0);
  const max = Math.max(1, ...y.byMonth);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          backgroundImage: GRAIN,
          padding: "60px 72px 56px",
          fontFamily: "Plex Mono",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", ...eyebrow }}>Bookshelf inventory</div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontFamily: "Caslon",
              fontSize: 94,
              color: INK,
            }}
          >
            {raw} in reading
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontFamily: "Caslon",
              fontSize: 38,
              color: INK_2,
            }}
          >
            {y.books.length
              ? `${y.books.length} ${y.books.length === 1 ? "book" : "books"} finished${
                  y.busiest ? `, most of them in ${y.busiest.month}` : ""
                }`
              : "No finish dates recorded for this year"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              height: 210,
            }}
          >
            {y.byMonth.map((n, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: 74,
                }}
              >
                {n > 0 ? (
                  <div style={{ display: "flex", fontSize: 22, color: INK_3, marginBottom: 8 }}>
                    {n}
                  </div>
                ) : null}
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: n > 0 ? Math.round((n / max) * 160) : 3,
                    background: n > 0 ? WALNUT : RULE,
                    borderRadius: "4px 4px 0 0",
                  }}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 12,
              paddingTop: 12,
              borderTop: `1px solid ${RULE}`,
              fontSize: 20,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: INK_3,
            }}
          >
            {MONTHS.map((m) => (
              <div key={m} style={{ display: "flex", width: 74, justifyContent: "center" }}>
                {m}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() }
  );
}
