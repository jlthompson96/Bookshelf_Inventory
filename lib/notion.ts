const NOTION_VERSION = "2025-09-03";

/**
 * The inventory lives in two Notion databases with near-identical schemas: the
 * shelf, and a chest the overflow is piled into. They differ only in what the
 * grouping and position properties are called, and in whether a row that has
 * neither yet is meaningful — hence the descriptor rather than a second copy of
 * this module.
 */
export type Collection = {
  id: string;
  /** The select property naming the group: a shelf, or a pile in the chest. */
  group: string;
  /** The number property giving position within that group. */
  position: string;
  /** How a row with no group or position should be read. The chest is being
      filled in by hand, so an unplaced book there is a normal state; on the
      shelf the same row is malformed and gets dropped. */
  keepUnplaced: boolean;
};

export const SHELF: Collection = {
  id: "5e248392-ff8b-4c2c-a47e-096decdb36e8",
  group: "Shelf #",
  position: "Position (L --> R)",
  keepUnplaced: false,
};

export const CHEST: Collection = {
  id: "3cd138a7-3367-8024-bb76-ebf0aed54a8e",
  group: "Stack #",
  /* Books lie flat in the chest, so position 1 is the one on the bottom. */
  position: "Position (B --> T)",
  keepUnplaced: true,
};

export type BookCore = {
  /** The Notion page id, dashless. The only stable handle a row has: the title
      can be edited and the position moves, so every link, cache key and share
      URL is built on this. */
  id: string;
  t: string;
  a: string;
  s: "Read" | "Reading" | "Unread";
  g: string[];
  u: string;
  pages?: number;
  rating?: number;
  finished?: string;
};

/** A shelved volume. Always placed, because toBook drops the rows that are not. */
export type Book = BookCore & { sh: number; p: number };

/** A volume in the chest, which may not have been assigned a pile yet. */
export type ChestBook = BookCore & { sh: number | null; p: number | null };

export const isPlaced = (b: ChestBook): b is Book => b.sh != null && b.p != null;

export type FailureKind = "no-token" | "unauthorized" | "no-access" | "unknown";

export class NotionError extends Error {
  kind: FailureKind;
  detail: string;

  constructor(kind: FailureKind, detail: string) {
    super(detail);
    this.name = "NotionError";
    this.kind = kind;
    this.detail = detail;
  }
}

function token(): string {
  const t = process.env.NOTION_TOKEN;
  if (!t) throw new NotionError("no-token", "NOTION_TOKEN is not set on this deployment.");
  return t;
}

async function notion(path: string, init: RequestInit & { revalidate?: number } = {}) {
  const { revalidate = 300, ...rest } = init;
  /* A mutation must never be served from, or written to, the data cache.
     `revalidate: 0` is not the same thing: it still enters the cache and would
     let a second identical create be deduped into the first one's response. */
  const caching: RequestInit =
    revalidate < 0 ? { cache: "no-store" } : { next: { revalidate } };

  const res = await fetch(`https://api.notion.com${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    ...caching,
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new NotionError("unauthorized", body);
    if (res.status === 403 || res.status === 404) throw new NotionError("no-access", body);
    throw new NotionError("unknown", `${res.status}: ${body}`);
  }

  return res.json();
}

const database = (collection: Collection) =>
  notion(`/v1/databases/${collection.id}`, { method: "GET", revalidate: 3600 });

/**
 * On API version 2025-09-03 a database exposes a data_sources array, and both
 * queries and page creation address that id rather than the database's. Older
 * versions have neither, hence the null. Reading it at runtime means a renamed
 * or re-provisioned data source cannot silently turn into a 404.
 *
 * Both collections cache independently: the fetch cache keys on the URL, and
 * the two databases have different ids.
 */
async function dataSourceId(collection: Collection): Promise<string | null> {
  const db = await database(collection);
  return db?.data_sources?.[0]?.id ?? null;
}

/**
 * Resolves the endpoint to query rather than hardcoding a data source id.
 */
async function queryPath(collection: Collection): Promise<string> {
  const id = await dataSourceId(collection);
  return id ? `/v1/data_sources/${id}/query` : `/v1/databases/${collection.id}/query`;
}

/** The optional properties toBook reads but that a database need not define. */
export type Optional = "pages" | "rating" | "finished" | "location";

export type Schema = {
  statuses: string[];
  shelves: string[];
  genres: string[];
  ratings: string[];
  locations: string[];
  /** Which optional properties this database actually defines. */
  has: Record<Optional, boolean>;
};

const PROPERTY: Record<Optional, string> = {
  pages: "Pages",
  rating: "Rating",
  finished: "Date Finished",
  location: "Location",
};

/**
 * The option lists as Notion actually holds them. The add form offers only
 * these, which matters most for Status: a `status` property's options cannot be
 * created through the API, so an unrecognised name is a 400 rather than a new
 * option. `select` and `multi_select` do accept new names, but a genre Notion
 * has never seen renders in fallback grey on the shelf, so the form steers
 * toward the existing palette instead.
 *
 * The schema is read from the data source, not the database. On version
 * 2025-09-03 `GET /v1/databases/{id}` no longer carries a `properties` object
 * at all — it describes the container, and the columns live on the data source
 * underneath it. Reading the database here returns quietly empty option lists
 * rather than an error, which is the failure that hides: the form falls back to
 * defaults and simply offers no genres.
 */
export async function getSchema(collection: Collection = SHELF): Promise<Schema> {
  const id = await dataSourceId(collection);
  const source = id
    ? await notion(`/v1/data_sources/${id}`, { method: "GET", revalidate: 3600 })
    : await database(collection);

  const props = source?.properties ?? {};
  const names = (prop: any): string[] =>
    (prop?.select?.options ?? prop?.multi_select?.options ?? prop?.status?.options ?? []).map(
      (o: any) => o.name as string
    );

  const has = Object.fromEntries(
    (Object.keys(PROPERTY) as Optional[]).map((k) => [k, PROPERTY[k] in props])
  ) as Record<Optional, boolean>;

  return {
    statuses: names(props["Status"]),
    shelves: names(props[collection.group]),
    genres: names(props["Genre"]),
    ratings: names(props["Rating"]),
    locations: names(props["Location"]),
    has,
  };
}

const text = (prop: any): string =>
  (prop?.rich_text ?? prop?.title ?? []).map((r: any) => r.plain_text).join("").trim();

type NotionPage = {
  id: string;
  url: string;
  properties: Record<string, any>;
  parent?: { data_source_id?: string; database_id?: string };
};

/* Notion hands ids back dashed and accepts them either way. Links carry the
   dashless form, so it is the one stored — comparing a dashed id to a bare one
   is a bug that only shows up as a book that cannot be found. */
const bare = (id: string) => id.replace(/-/g, "").toLowerCase();

function toBook(page: NotionPage, collection: Collection): ChestBook | null {
  const props = page.properties;
  const title = text(props["Title"]);
  if (!title) return null;

  const raw = Number(props[collection.group]?.select?.name);
  const group = Number.isFinite(raw) ? raw : null;
  const position = props[collection.position]?.number ?? null;
  if (!collection.keepUnplaced && (group == null || position == null)) return null;

  return {
    id: bare(page.id),
    t: title,
    a: text(props["Author"]) || "Unknown",
    s: (props["Status"]?.status?.name as BookCore["s"]) ?? "Unread",
    sh: group,
    p: position,
    g: (props["Genre"]?.multi_select ?? []).map((o: any) => o.name),
    u: page.url,
    pages: props["Pages"]?.number ?? undefined,
    rating: props["Rating"]?.select?.name ? Number(props["Rating"].select.name) : undefined,
    finished: props["Date Finished"]?.date?.start ?? undefined,
  };
}

/**
 * A row toBook dropped, kept for the audit rather than discarded. Identified by
 * its Notion URL rather than by title, since a title is exactly what "no-title"
 * means it does not have.
 */
export type Reject = {
  id: string;
  url: string;
  title: string | null;
  why: "no-title" | "no-group" | "no-position";
};

/**
 * Why toBook would drop this page, for a page it already has. Only called on a
 * page toBook rejected, so by construction one of these conditions holds —
 * mirrors toBook's own rule (see there) rather than sharing code with it,
 * because toBook returns a book or nothing and has no channel to also explain
 * a nothing.
 */
function classifyReject(page: NotionPage, collection: Collection): Reject {
  const title = text(page.properties["Title"]) || null;
  if (!title) return { id: bare(page.id), url: page.url, title: null, why: "no-title" };

  const raw = Number(page.properties[collection.group]?.select?.name);
  const group = Number.isFinite(raw) ? raw : null;
  if (group == null) return { id: bare(page.id), url: page.url, title, why: "no-group" };

  return { id: bare(page.id), url: page.url, title, why: "no-position" };
}

/**
 * Every row in a collection, unsorted. Callers order them as their view needs.
 * A row toBook drops is pushed onto `rejects` when the caller supplies one —
 * every browsing view leaves it undefined and pays nothing for the check; only
 * the audit asks what got dropped and why.
 */
async function rows(collection: Collection, rejects?: Reject[]): Promise<ChestBook[]> {
  const path = await queryPath(collection);
  const books: ChestBook[] = [];
  let cursor: string | undefined;

  do {
    // Sorting happens in the callers rather than in the request: it avoids
    // depending on the exact spelling of the position property, and each view
    // needs a group-then-position order anyway.
    const data = await notion(path, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });

    for (const page of data.results as NotionPage[]) {
      const book = toBook(page, collection);
      if (book) books.push(book);
      else rejects?.push(classifyReject(page, collection));
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return books;
}

export async function getBooks(): Promise<Book[]> {
  /* SHELF never keeps unplaced rows, so the guard is a narrowing filter rather
     than a cast — nothing is actually dropped here. */
  const books = (await rows(SHELF)).filter(isPlaced);
  return books.sort((x, y) => x.sh - y.sh || x.p - y.p);
}

/* A missing value sorts last, expressed as a rank rather than by standing in an
   Infinity: subtracting one Infinity from another is NaN, and a comparator
   that can return NaN is only accidentally a total order. A row with a pile
   but no position still lands ahead of one with neither, which puts the
   half-filled rows at the top of the unplaced list where they can be finished
   off. Shared with getAudit, which sorts the same rows the same way. */
function sortChest<T extends ChestBook>(books: T[]): T[] {
  const rank = (v: number | null) => (v == null ? 1 : 0);
  return books.sort(
    (x, y) =>
      rank(x.sh) - rank(y.sh) ||
      (x.sh ?? 0) - (y.sh ?? 0) ||
      rank(x.p) - rank(y.p) ||
      (x.p ?? 0) - (y.p ?? 0) ||
      x.t.localeCompare(y.t)
  );
}

/**
 * The chest, piles first and then whatever has not been given one yet. Unplaced
 * books are kept rather than dropped: the pile numbers are being filled in by
 * hand in Notion, and a book in the chest is in the chest either way.
 */
export async function getChestBooks(): Promise<ChestBook[]> {
  return sortChest(await rows(CHEST));
}

/**
 * Both collections again, but keeping what toBook drops instead of discarding
 * it — the one thing the shelf doctor needs that no browsing view does. A
 * second pair of Notion queries rather than a shared cache with getBooks and
 * getChestBooks: the fetch cache already keys on the request, so in practice
 * this costs nothing extra within the five-minute window either view is
 * serving from.
 */
export async function getAudit(): Promise<{
  shelf: Book[];
  chest: ChestBook[];
  rejected: Reject[];
}> {
  const shelfRejects: Reject[] = [];
  const chestRejects: Reject[] = [];
  const [shelfRows, chestRows] = await Promise.all([
    rows(SHELF, shelfRejects),
    rows(CHEST, chestRejects),
  ]);

  const shelf = shelfRows.filter(isPlaced).sort((x, y) => x.sh - y.sh || x.p - y.p);
  const chest = sortChest(chestRows);

  return { shelf, chest, rejected: [...shelfRejects, ...chestRejects] };
}

/**
 * One row by page id, for the deep-linked card at /book/<id>.
 *
 * A direct page read rather than a scan of both collections: it is one request
 * instead of two paginated queries, and the page's parent is what says which
 * collection it belongs to — that is, whether the card should say "Shelf" or
 * "Pile".
 *
 * The parent check is not decoration. The integration can see every database on
 * the Bookshelf Inventory page, so without it any id the token can reach would
 * render as a book, including rows from a database that is not part of this
 * inventory at all.
 */
export async function getBookById(
  id: string
): Promise<{ book: ChestBook; collection: Collection } | null> {
  if (!/^[0-9a-f]{32}$/.test(bare(id))) return null;

  let page: NotionPage;
  try {
    page = await notion(`/v1/pages/${bare(id)}`, { method: "GET" });
  } catch (err) {
    /* A page the token cannot see is indistinguishable from one that does not
       exist, and both are a 404 on a URL someone pasted — not an outage. A
       missing token or a dead Notion still throws, because those are. */
    if (err instanceof NotionError && err.kind === "no-access") return null;
    throw err;
  }

  const [shelfSource, chestSource] = await Promise.all([
    dataSourceId(SHELF),
    dataSourceId(CHEST),
  ]);

  const parent = page.parent ?? {};
  const owner = (c: Collection, source: string | null) =>
    (source != null && bare(parent.data_source_id ?? "") === bare(source)) ||
    bare(parent.database_id ?? "") === bare(c.id);

  const collection = owner(SHELF, shelfSource)
    ? SHELF
    : owner(CHEST, chestSource)
      ? CHEST
      : null;
  if (!collection) return null;

  /* toBook still applies the collection's own rules, so a shelf row missing its
     position is a 404 here exactly as it is absent from the shelf. */
  const book = toBook(page, collection);
  return book ? { book, collection } : null;
}

export type NewBook = {
  title: string;
  author: string;
  status: Book["s"];
  shelf: number;
  position: number;
  genres: string[];
  pages?: number;
  rating?: number;
  finished?: string;
};

/**
 * The inverse of toBook. Shelf and Rating are `select` properties holding
 * numerals, so they go back as strings — toBook coerces them with Number() on
 * the way in, and sending a number here is a 400.
 *
 * Optional properties are sent only where the database defines them. toBook
 * reads Pages, Rating and Date Finished, but a database is not obliged to have
 * them, and naming a property that does not exist fails the whole create.
 */
export async function createBook(
  input: NewBook,
  collection: Collection = SHELF
): Promise<{ id: string; url: string }> {
  const [id, schema] = await Promise.all([dataSourceId(collection), getSchema(collection)]);
  const parent = id ? { data_source_id: id } : { database_id: collection.id };

  const properties: Record<string, unknown> = {
    Title: { title: [{ text: { content: input.title } }] },
    Author: { rich_text: [{ text: { content: input.author } }] },
    Status: { status: { name: input.status } },
    [collection.group]: { select: { name: String(input.shelf) } },
    [collection.position]: { number: input.position },
    Genre: { multi_select: input.genres.map((name) => ({ name })) },
  };

  /* Omitted rather than sent as null: an absent page count should leave the
     property untouched so the spine falls back to its hashed geometry. */
  if (schema.has.pages && input.pages != null) properties["Pages"] = { number: input.pages };
  if (schema.has.rating && input.rating != null)
    properties["Rating"] = { select: { name: String(input.rating) } };
  if (schema.has.finished && input.finished)
    properties["Date Finished"] = { date: { start: input.finished } };

  /* Location is not part of the shelf model, but every existing row carries it
     and a book that arrives without it reads as a stray in Notion's own views. */
  if (schema.has.location && schema.locations.length)
    properties["Location"] = { multi_select: [{ name: schema.locations[0] }] };

  const page = await notion("/v1/pages", {
    method: "POST",
    body: JSON.stringify({ parent, properties }),
    revalidate: -1,
  });

  return { id: bare(page.id), url: page.url };
}
