# Bookshelf Inventory

Bookshelf Inventory turns a Notion database into an interactive physical bookshelf. Books
are drawn in shelf and left-to-right position order, with read volumes shown as colored
cloth spines and unread volumes shown as hollow spines. Hover or focus a spine to view its
catalog card.

Live deployment: <https://bookshelf-inventory-jlthompson96s-projects.vercel.app>

## Stack

- Next.js 15 with the App Router
- React 19 and TypeScript
- Notion API
- Google fonts loaded through `next/font`: Libre Caslon Display, IBM Plex Sans, and IBM Plex Mono

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
| `Rating` | Select | Parsed and retained for future sorting |
| `Date Finished` | Date | Parsed and retained for a future reading timeline |

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
