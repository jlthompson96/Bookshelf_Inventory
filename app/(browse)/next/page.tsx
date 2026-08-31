import { Suspense } from "react";
import { getBooks, getChestBooks, NotionError, type ChestBook, type FailureKind } from "@/lib/notion";
import ReadNext from "@/components/ReadNext";
import NotionFailure from "@/components/NotionFailure";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "What to read next",
  description: "A nudge toward the next book: narrow the pile down with a few questions, or take a pick at random.",
};

export default async function NextPage() {
  let shelf: ChestBook[] = [];
  let chest: ChestBook[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    /* Both collections: a book waiting to be read is a candidate whether it is
       standing on the shelf or lying in the chest. */
    [shelf, chest] = await Promise.all([getBooks(), getChestBooks()]);
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

  /* Wrapped like the other browsing views: it renders on the client and the
     modal interception under (browse) expects a client boundary here. */
  return (
    <Suspense>
      <ReadNext shelf={shelf} chest={chest} />
    </Suspense>
  );
}
