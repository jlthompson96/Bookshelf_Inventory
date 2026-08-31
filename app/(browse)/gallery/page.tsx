import { Suspense } from "react";
import { getBooks, getChestBooks, NotionError, type ChestBook, type FailureKind } from "@/lib/notion";
import Gallery from "@/components/Gallery";
import NotionFailure from "@/components/NotionFailure";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The gallery",
  description: "Every volume on the shelf and in the chest, drawn as its cover.",
};

export default async function GalleryPage() {
  let shelf: ChestBook[] = [];
  let chest: ChestBook[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    /* Both collections, because the gallery is the one view that shows the
       whole collection at once — a book you own is a book you own, whether it
       is on the shelf or in the chest. */
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

  /* Gallery reads the filter state out of the URL with useSearchParams, which
     needs its own boundary. */
  return (
    <Suspense>
      <Gallery shelf={shelf} chest={chest} />
    </Suspense>
  );
}
