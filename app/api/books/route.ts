import { NextResponse } from "next/server";
import { getBooks, NotionError } from "@/lib/notion";

export const dynamic = "force-dynamic";

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
