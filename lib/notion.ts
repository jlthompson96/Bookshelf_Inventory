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
  const res = await fetch(`https://api.notion.com${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    next: { revalidate },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new NotionError("unauthorized", body);
    if (res.status === 403 || res.status === 404) throw new NotionError("no-access", body);
    throw new NotionError("unknown", `${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Resolves the endpoint to query rather than hardcoding a data source id.
 * On API version 2025-09-03 a database exposes a data_sources array and the
 * query lives under that id; on older versions the database id is queried
 * directly. Reading it at runtime means a renamed or re-provisioned data
 * source cannot silently turn into a 404.
 */
async function queryPath(): Promise<string> {
  const db = await notion(`/v1/databases/${DATABASE_ID}`, { method: "GET", revalidate: 3600 });
  const dataSourceId = db?.data_sources?.[0]?.id;
  return dataSourceId
    ? `/v1/data_sources/${dataSourceId}/query`
    : `/v1/databases/${DATABASE_ID}/query`;
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
