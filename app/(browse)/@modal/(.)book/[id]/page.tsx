import { notFound } from "next/navigation";
import { CHEST, getBookById } from "@/lib/notion";
import { getBookInfo } from "@/lib/bookinfo";
import { idFromParam } from "@/lib/href";
import BookModal from "@/components/BookModal";

export const dynamic = "force-dynamic";

/**
 * A book opened from inside the app: the same /book/<id> URL the standalone
 * page serves, intercepted so it draws as a dialog over the shelf that is
 * already on screen rather than replacing it.
 *
 * `(.)` matches navigations from the same segment level, and /, /chest and
 * /gallery are all children of the root — so one interceptor covers all three.
 * A cold load of the URL is not a navigation, so it falls through to
 * app/book/[id] and renders the full page instead. That is the whole point:
 * one address, which behaves as a dialog for someone browsing and as a page for
 * someone who was sent the link.
 */
export default async function InterceptedBookPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = idFromParam((await params).id);
  if (!id) notFound();

  const found = await getBookById(id);
  if (!found) notFound();

  /* Looked up here rather than in the browser: the request is already on the
     server, and the fetch cache makes a repeat opening free. The card renders
     complete, with no second round trip and no blurb skeleton. */
  const info = await getBookInfo(found.book.t, found.book.a);

  return (
    <BookModal
      book={found.book}
      kind={found.collection === CHEST ? "chest" : "shelf"}
      info={info}
    />
  );
}
