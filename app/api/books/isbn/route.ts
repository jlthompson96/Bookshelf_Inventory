import { NextResponse } from "next/server";
import { getBookByIsbn } from "@/lib/bookinfo";
import { normalizeIsbn } from "@/lib/isbn";

export async function GET(request: Request) {
  const raw = (new URL(request.url).searchParams.get("isbn") ?? "").slice(0, 20).trim();

  if (!raw) {
    return NextResponse.json({ error: "isbn is required" }, { status: 400 });
  }

  /* A failed check digit is a bad scan rather than an unknown book, and the
     scanner should keep looking instead of reporting a miss. */
  if (!normalizeIsbn(raw)) {
    return NextResponse.json({ error: "not a valid ISBN" }, { status: 400 });
  }

  const book = await getBookByIsbn(raw);

  /* A miss is an ordinary outcome: the catalogues do not know this printing,
     and the form opens blank for the details to be typed in. */
  return NextResponse.json(
    { book },
    { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=604800" } }
  );
}
