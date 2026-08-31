import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createBook, getBooks, getSchema, NotionError, type NewBook } from "@/lib/notion";
import { assertCanWrite, ForbiddenError } from "@/lib/auth";
import { occupantAt } from "@/lib/shelf";

export const dynamic = "force-dynamic";

const MAX = 200;
const str = (v: unknown, max = MAX) => (typeof v === "string" ? v.slice(0, max).trim() : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function GET() {
  try {
    const books = await getBooks();
    return NextResponse.json(
      { books, count: books.length },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } }
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

export async function POST(request: Request) {
  try {
    assertCanWrite();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
    }

    const title = str(body.title);
    const shelf = num(body.shelf);
    const position = num(body.position);
    if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
    if (shelf == null || position == null || position < 1) {
      return NextResponse.json(
        { error: "shelf and position must be numbers, and position at least 1" },
        { status: 400 }
      );
    }

    /* Checked against the live schema rather than a hardcoded list: Status is a
       Notion `status` property, whose options cannot be created through the
       API, so an unrecognised name would come back as an opaque 400. */
    const [schema, books] = await Promise.all([getSchema(), getBooks()]);

    const status = str(body.status) || "Unread";
    if (schema.statuses.length && !schema.statuses.includes(status)) {
      return NextResponse.json(
        { error: `unknown status "${status}"`, allowed: schema.statuses },
        { status: 400 }
      );
    }

    /* A second book in an occupied slot is silent corruption on the shelf —
       two spines drawn over each other, with no hint which is misfiled. */
    const occupant = occupantAt(books, shelf, position);
    if (occupant) {
      return NextResponse.json(
        {
          error: "position is taken",
          detail: `Shelf ${shelf}, position ${position} already holds "${occupant.t}".`,
        },
        { status: 409 }
      );
    }

    const input: NewBook = {
      title,
      author: str(body.author) || "Unknown",
      status: status as NewBook["status"],
      shelf,
      position,
      genres: Array.isArray(body.genres)
        ? body.genres.map((g: unknown) => str(g, 100)).filter(Boolean).slice(0, 10)
        : [],
      pages: num(body.pages) ?? undefined,
      rating: num(body.rating) ?? undefined,
      finished: /^\d{4}-\d{2}-\d{2}$/.test(str(body.finished)) ? str(body.finished) : undefined,
    };

    const { id, url } = await createBook(input);

    /* getBooks caches for 300s, so without this the book just added is absent
       from the shelf for up to five minutes and the write looks like it failed. */
    revalidatePath("/");

    return NextResponse.json({ id, url }, { status: 201 });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "forbidden", detail: err.message }, { status: 403 });
    }
    if (err instanceof NotionError) {
      return NextResponse.json(
        { error: err.kind, detail: err.detail },
        { status: err.kind === "no-token" ? 500 : 502 }
      );
    }
    return NextResponse.json({ error: "unknown" }, { status: 502 });
  }
}
