# Bookshelf Inventory

Bookshelf Inventory turns a Notion database into an interactive physical bookshelf. Books
are drawn in shelf and left-to-right position order on a warm paper ground: read volumes
show a coloured cloth binding, unread volumes show an ivory page block. Select a spine to
open its catalog card as a modal.

The shelf can be searched by title or author, filtered by status and subject, and
reordered. Any order other than shelf position switches to a catalog view, because
sorting a shelf by title would misrepresent where the books physically are. Filter state
is mirrored into the URL, so a view can be shared and the Back button undoes it.

Not everything fits on the shelf. `/chest` draws a second Notion database, Storage Chest
Books, as the piles it actually is: each stack is a column of books lying flat, drawn
bottom to top, resting on the chest floor. It shares the shelf's palette, proportions and
catalog card. Books in the chest that have not been given a pile yet are listed under
"Not yet placed" rather than dropped, so the page is useful while the pile numbers are
still being filled in — see [The storage chest](#the-storage-chest).

Every book has its own address. `/book/<title>-<id>` opens the catalog card as a page, and
the same URL renders as a modal over whatever view it was opened from, so a card can be
linked, bookmarked and shared without leaving the shelf to reach it — see
[Deep links and share images](#deep-links-and-share-images).

`/gallery` draws the whole collection — shelf and chest together — as covers rather than
spines, fed by a batched lookup so a screenful of jackets is one request. `/stats` counts
what the inventory adds up to, and `/stats/<year>` is the reading year for books that
carry a finish date — see [Statistics and the reading year](#statistics-and-the-reading-year).

Books are shelved at `/add` by scanning the barcode on the back cover: the ISBN is looked
up in the catalogues, the form fills itself in, and the shelf suggests the next open slot.
This is the only route that writes to Notion, it writes to the shelf only, and it is off
unless deliberately enabled — see [Shelving a book](#shelving-a-book).

Every view is deliberately forgiving of a messy Notion row: a missing title is skipped
rather than crashing the page, an unrecognised genre falls back to a plain grey rather
than an error. `/doctor` is the other side of that forgiveness — what got quietly
skipped, drawn wrong, or is probably a mistake, with a link to the Notion row that fixes
it. Read-only, and not gated by `BOOKSHELF_WRITE_ENABLED` — see
[The shelf doctor](#the-shelf-doctor).

Light or dark, following the system by default and overridable from the nav in either
direction — see [Design system](#design-system).

Live deployment: <https://bookshelf-inventory-jlthompson96s-projects.vercel.app>

## Stack

- Next.js 15 with the App Router
- React 19 and TypeScript
- Notion API
- Open Library and Google Books, for cover art and catalogue detail. Neither needs a key.
- Google fonts loaded through `next/font`: Libre Caslon Display, IBM Plex Sans, and IBM Plex Mono
- No UI dependencies. The detail card is a native `<dialog>`, which supplies focus
  trapping, `Escape` to dismiss and top-layer stacking without a modal library.

## Design system

Every colour, type step and duration resolves through a token defined in
`app/globals.css`; components carry no raw hex. Presentation lives in CSS Modules
alongside each component, so the palette can be changed in one place.

The palette targets WCAG 2.2 AA. Body ink is 14.26:1 against the paper ground, secondary
ink 6.67:1, and metadata 4.98:1. `--rule` is decorative and must never bound a control —
anything outlining an interactive element uses `--rule-strong` (3.29:1), which clears the
3:1 required by 1.4.11. The eleven cloth colours are each verified at or above 4.64:1
against paper, since a spine renders its title in its own cloth colour.

### Dark mode

Three states, chosen from the toggle at the right edge of the nav: System (the default —
no attribute, `prefers-color-scheme` alone decides), Light and Dark. An explicit choice
is stamped as `data-theme` on `<html>`, persisted in `localStorage`, and applied by an
inline script before first paint so the page never flashes the light ground and then
repaints dark.

The dark values are a second, independently-verified palette — not an inversion or a
filter over the light one. `--walnut` is the one token deliberately left unchanged: a
walnut shelf reads as walnut in a dark room, and keeping it is what stops the board from
reading as more page rather than the lit object the books stand on. The eleven cloth
colours are a lightened set, each re-verified at or above 4.5:1 against `--paper-raised`
in dark — the light values are tuned for a dark cloth *fill*, and land under 3:1 as
*text* on a dark ground, which is how a read spine's title and the current-page nav chip
both use them. `lib/spine.ts`'s `clothHexFor` — the literal-colour path the satori share
images render through, since satori has no cascade and no theme — carries only the light
set; see the comment there.

Accessibility behaviour worth preserving when editing:

- Filtered-out spines are rendered as decorative `div`s, not focusable controls, so a
  keyboard user never lands on a dimmed target they cannot see.
- Status filters are a `radiogroup` with roving tabindex and arrow-key support, and signal
  selection with weight and a marker as well as colour.
- The result count is a live region, so filtering announces itself.
- The shelf scroller carries top padding because `overflow-x: auto` also makes the box
  scroll vertically, which would otherwise clip the lifted spine's focus ring.
- Shelf headings are sticky so they stay readable while a long shelf is scrolled.

## Requirements

- Node.js 18.18 or newer
- A Notion internal integration
- Access to the Bookshelf Inventory page, which holds both the Books and Storage Chest
  Books databases

## Local development

1. Create an internal integration at <https://www.notion.so/my-integrations>.
2. In the same Notion workspace, open the Bookshelf Inventory page and use **Connections**
   to connect the integration. Connect it to the page rather than only to an inline
   database, so access cascades to both the shelf and the storage chest. Sharing only the
   Books database leaves `/chest` showing the "cannot see the database" explainer.
3. Create `.env.local` in the repository root:

   ```env
   NOTION_TOKEN=ntn_your_internal_integration_secret
   # Optional. Only the publisher field and some blurbs depend on it.
   GOOGLE_BOOKS_API_KEY=your_google_books_key
   # Optional. Enables /add and POST /api/books; see "Shelving a book".
   BOOKSHELF_WRITE_ENABLED=true
   # Optional locally, required in the deployment: the origin share images and
   # canonical URLs resolve against. See "Deep links and share images".
   NEXT_PUBLIC_SITE_URL=https://your-deployment.vercel.app
   ```

4. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

Open <http://localhost:3000>. The page reports whether a missing token, invalid token, or
Notion sharing problem prevented the database from loading.

## Commands

```bash
npm run dev    # Start the development server
npm run build  # Create a production build
npm run start  # Serve the production build
```

## Notion database schema

Both database IDs are configured in `lib/notion.ts`, as the `SHELF` and `CHEST`
collections. A collection names the two properties that differ between them; everything
else below is shared. These properties are required:

| Property | Notion type | Purpose |
| --- | --- | --- |
| `Title` | Title | Book title |
| `Author` | Rich text | Author name |
| `Status` | Status | `Read`, `Reading`, or `Unread` |
| `Shelf #` / `Stack #` | Select | Numeric shelf, or pile in the chest |
| `Position (L --> R)` / `Position (B --> T)` | Number | Position along the shelf, or up from the bottom of the pile |
| `Genre` | Multi-select | Subject headings and spine colors |

These properties are optional:

| Property | Notion type | Effect |
| --- | --- | --- |
| `Pages` | Number | Makes spine thickness and height proportional to page count |
| `Rating` | Select | Shown in the catalog card, and sortable as "Highest rated" |
| `Date Finished` | Date | Shown in the catalog card, and sortable as "Recently finished" |

Rows without a title are skipped everywhere. On the shelf a row missing its shelf number
or position is skipped too, because there is nowhere to draw it; in the chest the same row
is kept and listed as not yet placed. Results are sorted in the application by group and
then position. Notion responses are cached for five minutes.

## The storage chest

`/chest` reads the Storage Chest Books database, whose schema matches the shelf's except
that `Shelf #` is `Stack #` and `Position (L --> R)` is `Position (B --> T)` — books lie
flat in a chest, so position 1 is the one on the bottom of the pile with everything else
resting on it. The piles are drawn in that order, and `lib/shelf.ts` supplies the geometry
for both views, so a gap in the numbering shows as a gap in the pile exactly as it does on
the shelf.

The two views share `lib/spine.ts`: one cloth palette, one set of proportions, one call
number format. A spine standing on a shelf is tall and thin and a book lying flat is wide
and shallow, so the same two numbers land on opposite axes in each view rather than being
computed twice.

Books whose pile has not been assigned appear under "Not yet placed" instead of being
dropped. A row with a `Stack #` but no position counts as unplaced — there is no way to
know where in the pile it sits — and sorts to the top of that list. Fill both in on the
Notion side and the book moves into its pile with no code change.

The chest is read-only. `/add` and the scanner write to the shelf database only.

## Deep links and share images

A card is a route, not a piece of client state. `/book/<slug>-<id>` is the address; the
slug is decoration and the id — the Notion page id — is what resolves, so a book that gets
retitled keeps every link ever shared for it.

The same URL renders two ways. Reached from inside the app it is an *intercepting route*:
the card opens as a dialog over the shelf, the shelf stays mounted with its filters and
scroll position intact, and Back closes the card by returning to the view underneath. The
filter query string is carried onto every card link so that view comes back as it was.
Reached cold — pasted, bookmarked, followed from a crawler — the same URL renders the full
page instead, server-rendered in one response.

The interception lives in `app/(browse)/@modal/(.)book/[id]`, and the browsing views sit in
the `(browse)` route group with it. The group is load-bearing: a page that calls
`notFound()` while a sibling parallel slot still resolves answers **200**, so with the slot
at the app root a link to a deleted book returned "This page could not be found" under a
200 — exactly what a crawler indexes. Scoped to the group, `/book/<id>` is an ordinary
route again and its 404 is real.

Every book, and every reading year, has a generated share image at 1200x630 — a bound
volume in its own cloth colour, title in Libre Caslon, drawn from Notion data alone. No
cover art: fetching one would put a catalogue lookup and an image download inside image
generation, on a path that has to answer a crawler quickly and gets no second chance if it
times out.

Three things about `next/og` are worth knowing before editing `app/_og/card.tsx`, because
each fails silently rather than erroring:

- Satori has no block layout. Any element with more than one child needs an explicit
  `display: flex`, or its children stack on top of each other.
- There is no cascade and no stylesheet. Every style is inline and every colour is a
  literal — a `var(--paper)` paints nothing. This is why `lib/spine.ts` carries a
  `clothHex` alongside `clothFor`; the two must stay in step with `app/globals.css`.
- Fonts are supplied as buffers, and satori cannot parse woff2 — which is what
  `fonts.googleapis.com` serves by default. Both faces are vendored as TTF under
  `app/_og/` and read off disk. They are traced into the deployment by
  `outputFileTracingIncludes` in `next.config.mjs`; nothing imports them, so without that
  entry the tracer cannot see they are needed.

Set `NEXT_PUBLIC_SITE_URL` in the deployment environment. Without it `metadataBase` falls
back to the project's `vercel.app` hostname, or to `localhost` — and a crawler cannot
resolve a relative `og:image`, so the preview comes out blank.

## Statistics and the reading year

`/stats` counts the whole inventory, shelf and chest together: volumes, status, distinct
authors, and volumes per subject and per shelf. `/stats/<year>` is one reading year — what
was finished, by month, with the subjects and the list.

The reading year depends on `Date Finished`, and `Pages` and `Rating` fill in the rest.
All three are optional properties that a database need not define, so every figure is
reported next to its coverage: how many of the books it could have counted actually carry
the date. A year that quietly says "3" when the truth is "3 recorded out of 38 read" is
worse than one that says nothing. Where no book carries a finish date at all, `/stats`
says so and names the property to add rather than drawing an empty chart.

Charts are hand-drawn HTML — a bar is a box of a given width — and colour never carries
the meaning in either of them. The cloth palette is the app's identity for a subject and
is used for continuity, but it does not survive as a chart palette: run it through a
colour-vision check and Dystopian Fiction against Gothic / Horror comes out at 1.8 Delta E
for a deuteranope, and 4.2 for normal vision, which is to say most readers cannot tell
those two apart either. So every bar is named on its own row, the length is the encoding,
and no legend is ever keyed on those colours. The month bars are flat: the height already
says how many, and shading them by the same number would only say it twice.

## Catalogue lookup

Cover art, the blurb, first publication year, publisher, ISBN and catalogue subjects are
not stored in Notion. They are looked up in `lib/bookinfo.ts` when a catalog card is
opened, so the shelf itself costs nothing to render and the Notion schema stays as it is.

Since Notion holds no ISBN, the lookup is a title-and-author guess. Candidates are
verified before anything is shown: the folded titles must agree and the author's surname
must appear on the record, so a near miss renders the plain card rather than another
book's cover. A book neither catalogue knows simply keeps the card it has today. Results
are cached for a day on the server and for the session in the browser.

Both sources are queried at once, and each answers what it is good for. Open Library is
authoritative: it is key-free, unmetered, and supplies the cover, the first publication
year, the ISBN and the subject headings. It is **not** asked for the publisher — its
`publisher` field lists every edition in arbitrary order, so the first entry for *Dune* is
a French house. The publisher therefore comes from Google Books, which names one real
edition, and Google also fills in a blurb where Open Library has none.

Google Books has no keyless quota worth relying on. Anonymous requests share one pool that
is usually already spent, so a 429 there is routine and costs only the publisher field.
Set `GOOGLE_BOOKS_API_KEY` in `.env.local` (and in the deployment environment) for a quota
of your own. Everything else works without it.

## The shelf doctor

`/doctor` is what every other view's forgiveness costs, made visible. `toBook` in
`lib/notion.ts` silently drops a row with no title, or a shelf row missing its shelf
number or position; `lib/spine.ts` silently falls back to a flat grey for a genre it has
no cloth colour for; a blank author silently guarantees the catalogue lookup misses.
Each of those is the right behaviour for a page trying to draw a shelf — a crash over one
bad row would be worse — but the person maintaining the Notion database never sees any
of it happen. The doctor is the one place that changes.

Every finding names what is true, what the app does about it today, and the affected
rows, each linking to both its catalog card and its Notion page. Findings are ranked by
consequence rather than by colour: **Dropped** (not rendered anywhere), **Drawn wrong**
(rendered, but incorrectly — an unmapped genre, a shelf position claimed by two books),
and **Worth a look** (rendered fine, but probably not intended — a title present in both
the shelf and the chest, a long run of empty slots). A clean inventory reports "Nothing
to fix" and lists the checks that ran, rather than an empty page.

Everything on the page runs from the same Notion reads `/` and `/chest` already make,
except one: a button to check every book against the catalogue lookup that powers the
gallery and the catalog card, which costs one request per 24 books and so runs on demand
rather than on every visit. Nothing on this page writes to Notion, and it needs no flag —
unlike `/add` it only reads what `GET /api/books` already exposes publicly.

## JSON API

`GET /api/books` returns the same inventory used by the page. Each book carries an `id` —
the Notion page id, dashless — which is what `/book/<id>` and the cover endpoint resolve on:

```json
{
  "books": [
    {
      "id": "e1f9468644574fbf950241c41f7b54b9",
      "t": "Harry Potter and the Sorcerer's Stone",
      "a": "J.K. Rowling",
      "s": "Read",
      "sh": 1,
      "p": 1,
      "g": ["Fantasy", "Adventure"],
      "u": "https://www.notion.so/..."
    }
  ],
  "count": 0
}
```

Successful responses use a five-minute shared cache. Configuration and Notion failures
return an `error` value and, where available, a `detail` value.

`GET /api/books/info?title=…&author=…` returns the catalogue lookup for one book:

```json
{
  "info": {
    "cover": "https://covers.openlibrary.org/b/id/…-M.jpg",
    "description": "…",
    "year": 1965,
    "publisher": "Chilton Books",
    "pages": 412,
    "subjects": [],
    "isbn": "9780441013593",
    "source": "openlibrary",
    "sourceUrl": "https://openlibrary.org/works/…"
  }
}
```

`title` is required and both parameters are capped at 200 characters. A book the
catalogues do not know returns `{ "info": null }` with a 200, because a miss is an
ordinary outcome rather than an error. Responses use a one-day shared cache.

`GET /api/books/isbn?isbn=…` resolves one ISBN to a book. Unlike the lookup above it does
no fuzzy verification, because an ISBN names exactly one edition:

```json
{
  "book": {
    "title": "The Hobbit",
    "author": "J.R.R. Tolkien",
    "pages": 300,
    "year": 2012,
    "publisher": "Mariner Books",
    "isbn": "9780547928227",
    "source": "openlibrary",
    "sourceUrl": "https://openlibrary.org/books/…"
  }
}
```

Hyphens and spaces are ignored. ISBN-10 and ISBN-13 are both accepted, and the check digit
is validated before any request is made — a failed check digit is a 400, since it means a
misread barcode rather than an unknown book. An unknown ISBN returns `{ "book": null }`
with a 200. Responses use a one-week shared cache.

`GET /api/books/covers?ids=…` returns cover art for up to 24 books at once, which is what
the gallery runs on:

```json
{
  "covers": {
    "e1f9468644574fbf950241c41f7b54b9": {
      "cover": "https://covers.openlibrary.org/b/id/276518-M.jpg",
      "isbn": "9780439211161",
      "year": 2000,
      "source": "openlibrary"
    }
  }
}
```

Ids are comma-separated and resolved to titles server-side against the cached inventory, so
the URL stays short enough to be a cacheable GET and the route cannot be used as an
anonymous proxy for arbitrary catalogue searches. More than 24 is a 400 naming the cap,
rather than a silent truncation that would look like missing covers. An id the inventory
does not hold, and a book the catalogues do not know, are both `null` with a 200.

The payload is deliberately thin — a tile needs a URL, not a blurb — and the lookup behind
it skips the second Open Library request that `/api/books/info` spends on a description.
Requests run six at a time rather than all at once: twenty-four resolved in parallel is up
to forty-eight upstream calls in one tick, which Open Library rate-limits and the keyless
Google quota simply refuses. Responses use a one-day shared cache.

`POST /api/books` creates a book, and is the only write in the API. It requires
`BOOKSHELF_WRITE_ENABLED` (see [Shelving a book](#shelving-a-book)) and returns 403
otherwise.

```json
{
  "title": "The Hobbit",
  "author": "J.R.R. Tolkien",
  "status": "Unread",
  "shelf": 2,
  "position": 7,
  "genres": ["Fantasy"],
  "pages": 300
}
```

`title`, `shelf` and `position` are required. A 201 returns the new page's `id` and `url`. An
unknown `status` is a 400 listing the allowed values, and a position already occupied on
that shelf is a 409 naming the book that holds it.

## Shelving a book

`/add` is the one route that writes to Notion. Scanning uses the camera to read the EAN-13
barcode on the back cover, resolves it against Open Library and Google Books, and prefills
the form; the ISBN can always be typed instead, so the page works without a camera. Shelf
and status offer only the options the Notion database actually holds — a `status`
property's options cannot be created through the API — and the position defaults to the
first gap on the chosen shelf, falling back to the end. A slot that is already occupied is
refused rather than double-booked.

The form is built from the database's live schema, which on API version 2025-09-03 lives on
the **data source** rather than the database — `GET /v1/databases/{id}` no longer returns a
`properties` object at all. Optional properties are handled by presence: `Pages`, `Rating`
and `Date Finished` are read by the shelf but a database need not define them, so the form
offers only the ones that exist and the create omits the rest. Naming a property Notion
does not have fails the whole write. `Location` is set from its first existing option when
the property is present, so a new book matches the rows already there.

Writes are opt-in:

```env
BOOKSHELF_WRITE_ENABLED=true
```

Without it, `/add` explains that shelving is switched off and `POST /api/books` returns a
403 without contacting Notion. The flag exists because Vercel Authentication cannot be
scoped to a single route: it protects the whole deployment or none of it, so a deployment
with protection turned off — to keep a Notion embed working, say — would otherwise expose
a public write endpoint on a personal database. Enable Vercel Authentication **and** set
the flag; the two together are what gate the write path.

The integration's Notion capabilities must include **Insert content**, which is separate
from read access and is not granted by default.

No WebKit browser implements the Barcode Detection API, so on iOS the scanner falls back
to a WebAssembly decoder (`barcode-detector`). It is imported dynamically and only when
needed, so neither the shelf nor the unopened scanner pays for it. Camera access requires
HTTPS, which `localhost` and Vercel both satisfy.

## Deployment and embedding

Deploy the project to Vercel or another Next.js host, then set `NOTION_TOKEN` and
`NEXT_PUBLIC_SITE_URL` in the deployment environment and redeploy. The second one is what
share previews resolve against; without it every `og:image` is emitted relative and no
crawler can follow it. To embed the shelf in Notion, add an `/embed` block
pointing to the deployed URL. Disable Vercel Authentication for the deployment or the
embed will show a login page.
