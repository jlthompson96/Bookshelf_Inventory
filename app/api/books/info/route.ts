import { NextResponse } from "next/server";
import { getBookInfo } from "@/lib/bookinfo";

const MAX = 200;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const title = (params.get("title") ?? "").slice(0, MAX).trim();
  const author = (params.get("author") ?? "").slice(0, MAX).trim();

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const info = await getBookInfo(title, author);

  /* A miss is an ordinary outcome, not a 404: the book exists on the shelf, the
     catalogues simply do not know it, and the card renders unenriched. */
  return NextResponse.json(
    { info },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } }
  );
}
