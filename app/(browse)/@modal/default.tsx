/**
 * The modal slot when no card is open, which is nearly always.
 *
 * A parallel route without a default renders a 404 for the whole page on any
 * navigation the slot does not match — including a hard reload of the shelf —
 * so this file is what keeps the slot silent rather than fatal.
 */
export default function Default() {
  return null;
}
