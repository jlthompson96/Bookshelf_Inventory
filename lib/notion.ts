const DATABASE_ID = "5e248392-ff8b-4c2c-a47e-096decdb36e8";
const NOTION_VERSION = "2025-09-03";

export type Book = {
  t: string;
  a: string;
  s: "Read" | "Reading" | "Unread";
  sh: number;
  p: number;
  g: string[];
  u: string;
  pages?: number;
  rating?: number;
  finished?: string;
};

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

const database = () =>
  notion(`/v1/databases/${DATABASE_ID}`, { method: "GET", revalidate: 3600 });

/**
 * On API version 2025-09-03 a database exposes a data_sources array, and both
 * queries and page creation address that id rather than the database's. Older
 * versions have neither, hence the null. Reading it at runtime means a renamed
 * or re-provisioned data source cannot silently turn into a 404.
 */
async function dataSourceId(): Promise<string | null> {
  const db = await database();
  return db?.data_sources?.[0]?.id ?? null;
}

/**
 * Resolves the endpoint to query rather than hardcoding a data source id.
 */
async function queryPath(): Promise<string> {
  const id = await dataSourceId();
  return id ? `/v1/data_sources/${id}/query` : `/v1/databases/${DATABASE_ID}/query`;
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
export async function getSchema(): Promise<Schema> {
  const id = await dataSourceId();
  const source = id
    ? await notion(`/v1/data_sources/${id}`, { method: "GET", revalidate: 3600 })
    : await database();

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
    shelves: names(props["Shelf #"]),
    genres: names(props["Genre"]),
    ratings: names(props["Rating"]),
    locations: names(props["Location"]),
    has,
  };
}

const text = (prop: any): string =>
  (prop?.rich_text ?? prop?.title ?? []).map((r: any) => r.plain_text).join("").trim();

type NotionPage = { id: string; url: string; properties: Record<string, any> };

function toBook(page: NotionPage): Book | null {
  const props = page.properties;
  const title = text(props["Title"]);
  if (!title) return null;

  const shelf = Number(props["Shelf #"]?.select?.name);
  const position = props["Position (L --> R)"]?.number;
  if (!Number.isFinite(shelf) || position == null) return null;

  return {
    t: title,
    a: text(props["Author"]) || "Unknown",
    s: (props["Status"]?.status?.name as Book["s"]) ?? "Unread",
    sh: shelf,
    p: position,
    g: (props["Genre"]?.multi_select ?? []).map((o: any) => o.name),
    u: page.url,
    pages: props["Pages"]?.number ?? undefined,
    rating: props["Rating"]?.select?.name ? Number(props["Rating"].select.name) : undefined,
    finished: props["Date Finished"]?.date?.start ?? undefined,
  };
}

export async function getBooks(): Promise<Book[]> {
  const path = await queryPath();
  const books: Book[] = [];
  let cursor: string | undefined;

  do {
    // Sorting happens below rather than in the request: it avoids depending on
    // the exact spelling of "Position (L --> R)", and the result needs a
    // shelf-then-position order anyway.
    const data = await notion(path, {
      method: "POST",
      body: JSON.stringify({ page_size: 100, start_cursor: cursor }),
    });

    for (const page of data.results as NotionPage[]) {
      const book = toBook(page);
      if (book) books.push(book);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);

  return books.sort((x, y) => x.sh - y.sh || x.p - y.p);
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
export async function createBook(input: NewBook): Promise<{ url: string }> {
  const [id, schema] = await Promise.all([dataSourceId(), getSchema()]);
  const parent = id ? { data_source_id: id } : { database_id: DATABASE_ID };

  const properties: Record<string, unknown> = {
    Title: { title: [{ text: { content: input.title } }] },
    Author: { rich_text: [{ text: { content: input.author } }] },
    Status: { status: { name: input.status } },
    "Shelf #": { select: { name: String(input.shelf) } },
    "Position (L --> R)": { number: input.position },
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

  return { url: page.url };
}
