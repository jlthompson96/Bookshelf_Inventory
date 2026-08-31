import { Suspense } from "react";
import { getChestBooks, NotionError, type ChestBook, type FailureKind } from "@/lib/notion";
import Chest from "@/components/Chest";
import NotionFailure from "@/components/NotionFailure";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Storage chest",
  description: "The overflow, piled in the chest, drawn from the Notion Storage Chest Books database.",
};

export default async function ChestPage() {
  let books: ChestBook[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    books = await getChestBooks();
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

  /* Chest reads the filter state out of the URL with useSearchParams, which
     needs its own boundary. */
  return (
    <Suspense>
      <Chest books={books} />
    </Suspense>
  );
}
