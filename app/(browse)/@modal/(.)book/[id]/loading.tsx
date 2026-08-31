/* The card's own route does the Notion read and the catalogue lookup, so there
   is a beat between the click and the dialog. Nothing is drawn for it: the
   shelf underneath is still there and still interactive, and a flash of empty
   dialog chrome reads worse than a card that simply arrives. */
export default function Loading() {
  return null;
}
