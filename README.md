# Bookshelf Inventory

Bookshelf Inventory turns a Notion database into an interactive physical bookshelf. Books
are drawn in shelf and left-to-right position order on a warm paper ground: read volumes
show a coloured cloth binding, unread volumes show an ivory page block. Select a spine to
open its catalog card as a modal.

The shelf can be searched by title or author, filtered by status and subject, and
reordered. Any order other than shelf position switches to a catalog view, because
sorting a shelf by title would misrepresent where the books physically are. Filter state
is mirrored into the URL, so a view can be shared and the Back button undoes it.

Live deployment: <https://bookshelf-inventory-jlthompson96s-projects.vercel.app>

## Stack

- Next.js 15 with the App Router
- React 19 and TypeScript
- Notion API
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
- Access to the Bookshelf Inventory database

## Local development

1. Create an internal integration at <https://www.notion.so/my-integrations>.
2. In the same Notion workspace, open the Bookshelf Inventory page and use **Connections**
   to connect the integration. Connect it to the page rather than only to the inline
   database so the database access is inherited.
3. Create `.env.local` in the repository root:

   ```env
   NOTION_TOKEN=ntn_your_internal_integration_secret
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

The database ID is configured in `lib/notion.ts`. These properties are required:

| Property | Notion type | Purpose |
| --- | --- | --- |
| `Title` | Title | Book title |
| `Author` | Rich text | Author name |
| `Status` | Status | `Read`, `Reading`, or `Unread` |
| `Shelf #` | Select | Numeric shelf number |
| `Position (L --> R)` | Number | Position from left to right |
| `Genre` | Multi-select | Subject headings and spine colors |

These properties are optional:

| Property | Notion type | Effect |
| --- | --- | --- |
| `Pages` | Number | Makes spine thickness and height proportional to page count |
| `Rating` | Select | Shown in the catalog card, and sortable as "Highest rated" |
| `Date Finished` | Date | Shown in the catalog card, and sortable as "Recently finished" |

Rows without a title, shelf number, or position are skipped. Results are sorted in the
application by shelf and then position. Notion responses are cached for five minutes.

## JSON API

`GET /api/books` returns the same inventory used by the page:

```json
{
  "books": [],
  "count": 0
}
```

Successful responses use a five-minute shared cache. Configuration and Notion failures
return an `error` value and, where available, a `detail` value.

## Deployment and embedding

Deploy the project to Vercel or another Next.js host, then set `NOTION_TOKEN` in the
deployment environment and redeploy. To embed the shelf in Notion, add an `/embed` block
pointing to the deployed URL. Disable Vercel Authentication for the deployment or the
embed will show a login page.
