import { ImageResponse } from "next/og";
import { CHEST, getBookById } from "@/lib/notion";
import { idFromParam } from "@/lib/href";
import { clothHex } from "@/lib/spine";
import { BRASS, GRAIN, INK, INK_2, INK_3, PAPER, RULE, SIZE, eyebrow, fonts } from "@/app/_og/card";

export const alt = "A book from the Bookshelf Inventory";
export const size = SIZE;
export const contentType = "image/png";

/**
 * The share card: a bound volume, drawn from Notion alone.
 *
 * No cover art, deliberately. Fetching one would mean a catalogue lookup and an
 * image download inside image generation, on a path that has to answer a
 * crawler quickly and gets no second chance if it times out — and the lookup is
 * a title-and-author guess that sometimes misses. A card that is always right
 * and always fast beats one that is occasionally richer.
 *
 * See app/_og/card.tsx for why everything here is inline and literal.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = idFromParam((await params).id);
  const found = id ? await getBookById(id) : null;

  /* A card for a book that is not here still has to be an image: a crawler that
     asked for one and got an error renders a broken preview rather than falling
     back to anything. */
  const book = found?.book;
  const cloth = book ? clothHex(book) : BRASS;
  const where =
    book && book.sh != null && book.p != null
      ? `${found!.collection === CHEST ? "Pile" : "Shelf"} ${book.sh} · Position ${book.p}`
      : book
        ? "Not yet placed"
        : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: PAPER,
          fontFamily: "Plex Mono",
        }}
      >
        {/* The bound edge, in the book's own cloth. */}
        <div style={{ display: "flex", width: 72, height: "100%", background: cloth }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "64px 72px",
            backgroundImage: GRAIN,
          }}
        >
          <div style={{ display: "flex", ...eyebrow }}>Bookshelf inventory</div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Caslon",
                fontSize: book && book.t.length > 44 ? 66 : 88,
                lineHeight: 1.08,
                color: INK,
                /* Satori has no ellipsis, so a very long title is cut by the
                   box instead — hence the size step above, which keeps almost
                   everything inside three lines. */
                maxHeight: 300,
                overflow: "hidden",
              }}
            >
              {book?.t ?? "Not in this inventory"}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 20,
                fontFamily: "Caslon",
                fontSize: 40,
                color: INK_2,
              }}
            >
              {book?.a ?? "This link does not name a book on the shelf."}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 28,
              paddingTop: 28,
              borderTop: `1px solid ${RULE}`,
              fontSize: 24,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: INK_3,
            }}
          >
            {/* Joined with a middot rather than left to the flex gap: in mono
                small caps a 28px gap reads as an ordinary word space, and
                "Position 1 Read" runs together as one phrase. */}
            {[
              where || null,
              book?.s ?? null,
              book?.rating
                ? `${"★".repeat(book.rating)}${"☆".repeat(Math.max(0, 5 - book.rating))}`
                : null,
            ]
              .filter(Boolean)
              .map((part, i) => (
                <div key={i} style={{ display: "flex", gap: 28 }}>
                  {i > 0 ? <span style={{ color: RULE }}>·</span> : null}
                  <span>{part}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() }
  );
}
