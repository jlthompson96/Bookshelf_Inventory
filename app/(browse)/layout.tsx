/**
 * The views a card can be opened from: the shelf, the chest and the gallery.
 *
 * The modal slot lives here rather than at the root so that it covers exactly
 * the pages that open cards. Putting it at the root also worked, but it put
 * /book/<id> underneath a parallel slot — and a page that calls notFound() with
 * a sibling slot still resolving answers 200, because one half of the tree
 * rendered fine. A link to a book that has since been deleted would have
 * returned "This page could not be found" under a 200, which is exactly the
 * response a crawler indexes. Scoped here, the standalone page is an ordinary
 * route again and its 404 is a real one.
 */
export default function BrowseLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
