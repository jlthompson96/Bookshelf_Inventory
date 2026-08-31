import { Suspense } from "react";
import { getBooks, NotionError, type Book, type FailureKind } from "@/lib/notion";
import Bookshelf from "@/components/Bookshelf";
import NotionFailure from "@/components/NotionFailure";

export const dynamic = "force-dynamic";

export default async function Page() {
  let books: Book[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    books = await getBooks();
  } catch (err) {
    if (err instanceof NotionError) {
      kind = err.kind;
      detail = err.detail;
    } else {
      kind = "unknown";
      detail = err instanceof Error ? err.message : String(err);
    }
  }

  if (kind) return <NotionFailure kind={kind} detail={detail} />;

  /* Bookshelf reads the filter state out of the URL with useSearchParams, which
     needs its own boundary. */
  return (
    <Suspense>
      <Bookshelf books={books} />
    </Suspense>
  );
}
