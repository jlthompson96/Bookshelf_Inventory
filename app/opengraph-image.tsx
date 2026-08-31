import { ImageResponse } from "next/og";
import { GRAIN, INK, INK_2, PAPER, RULE, SIZE, eyebrow, fonts } from "./_og/card";

export const alt = "Bookshelf Inventory";
export const size = SIZE;
export const contentType = "image/png";

/* The card for every page that does not draw its own — the shelf, the chest and
   the gallery. A row of cloth spines, in the palette's own colours, sized to
   fill the board rather than trailing off halfway across it. */
const SPINES = [
  { hex: "#8a5a24", h: 232 },
  { hex: "#2a5f8f", h: 268 },
  { hex: "#5c594e", h: 210 },
  { hex: "#9a3f63", h: 254 },
  { hex: "#376b57", h: 224 },
  { hex: "#a33520", h: 276 },
  { hex: "#6e3f94", h: 240 },
  { hex: "#7a6410", h: 216 },
  { hex: "#2f6b4c", h: 262 },
  { hex: "#a05a1e", h: 218 },
  { hex: "#5a468a", h: 246 },
  { hex: "#8a5a24", h: 208 },
  { hex: "#2a5f8f", h: 234 },
];

export default async function Image() {
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
          padding: "64px 72px 0",
          fontFamily: "Plex Mono",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", ...eyebrow }}>Bookshelf inventory</div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontFamily: "Caslon",
              fontSize: 92,
              color: INK,
            }}
          >
            The shelf, as it stands
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 18,
              fontFamily: "Caslon",
              fontSize: 34,
              color: INK_2,
            }}
          >
            Every volume in its real position, drawn from Notion.
          </div>
        </div>

        {/* Spines standing on the board, as on the page itself. */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          {SPINES.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                width: 74,
                height: s.h,
                background: s.hex,
                borderRadius: "2px 2px 0 0",
              }}
            />
          ))}
        </div>
        <div style={{ display: "flex", height: 14, background: "#6b4f32", margin: "0 -72px" }} />
      </div>
    ),
    { ...size, fonts: await fonts() }
  );
}
