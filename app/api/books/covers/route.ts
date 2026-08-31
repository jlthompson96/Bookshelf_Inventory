import { NextResponse } from "next/server";
import { getCovers } from "@/lib/bookinfo";
import { getBooks, getChestBooks, NotionError } from "@/lib/notion";

export const dynamic = "force-dynamic";

/**
 * Cover art for a batch of books, for the gallery.
 *
 * Keyed on page ids rather than taking title/author pairs from the caller, for
 * three reasons: the URL stays short enough to be a GET and therefore cacheable
 * by the CDN, the client never has to send anything it did not get from this
 * app, and the route cannot be used as an anonymous proxy for arbitrary
 * catalogue searches. Resolving ids costs two Notion reads that are cached for
 * five minutes and shared with the pages themselves, so in practice it is free.
 */

/* The gallery requests a screenful at a time. The cap is what keeps one request
   from turning into a hundred upstream lookups. */
const MAX = 24;

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f]{32}$/.test(s));

  if (!ids.length) {
    return NextResponse.json({ error: "ids is required" }, { status: 400 });
  }

  /* Refused rather than truncated: a caller asking for fifty has a bug, and
     silently answering half of it makes that bug look like missing covers. */
  if (ids.length > MAX) {
    return NextResponse.json(
      { error: `at most ${MAX} ids per request`, asked: ids.length },
      { status: 400 }
    );
  }

  try {
    const [shelf, chest] = await Promise.all([getBooks(), getChestBooks()]);
    const known = new Map([...shelf, ...chest].map((b) => [b.id, b]));

    const wanted = ids
      .map((id) => known.get(id))
      .filter((b) => b != null)
      .map((b) => ({ id: b.id, title: b.t, author: b.a }));

    const covers = await getCovers(wanted);
    /* An id that is not in either collection answers null rather than 400: the
       gallery may be a few minutes behind a book that has just been deleted,
       and one stale tile should not fail the whole screenful. */
    for (const id of ids) if (!(id in covers)) covers[id] = null;

    return NextResponse.json(
      { covers },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    if (err instanceof NotionError) {
      return NextResponse.json(
        { error: err.kind, detail: err.detail },
        { status: err.kind === "no-token" ? 500 : 502 }
      );
    }
    return NextResponse.json({ error: "unknown" }, { status: 502 });
  }
}
