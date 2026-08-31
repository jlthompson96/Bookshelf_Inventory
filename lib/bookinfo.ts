/**
 * Looks a book up in Open Library and Google Books so the catalog card can show
 * a cover, a blurb and publication facts that Notion does not hold. Notion rows
 * carry no ISBN, so every lookup is a title + author guess: the match is
 * verified before anything is returned, because a plausible wrong cover is
 * worse than no cover.
 */

import { normalizeIsbn } from "./isbn";

const UA = "Bookshelf-Inventory/1.2 (github.com/jlthompson96/Bookshelf_Inventory)";
const DAY = 86400;
const TIMEOUT = 5000;

export type BookInfo = {
  cover?: string;
  description?: string;
  year?: number;
  publisher?: string;
  pages?: number;
  subjects?: string[];
  isbn?: string;
  source: "openlibrary" | "google";
  sourceUrl: string;
};

/**
 * Every upstream failure is a miss, not an error: the card renders without
 * enrichment rather than reporting that a third party is down. The timeout is
 * what keeps a slow source from hanging an open modal.
 */
async function json(url: string, revalidate = DAY): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT),
      next: { revalidate },
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/* Matching happens on a folded form: case, accents, punctuation and a leading
   article all differ freely between a Notion row and a catalogue record.
   Exported for the shelf doctor, which folds a title the same way to find a
   book listed on both the shelf and in the chest — the same normalisation
   question, asked of two Notion rows instead of a Notion row and a catalogue
   record. */
export const fold = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    /* Spelled out rather than dropped: a shelf's "Jonathan Strange & Mr
       Norrell" and the catalogue's "Jonathan Strange and Mr. Norrell" have to
       fold together, and discarding the ampersand as punctuation leaves a word
       of difference in the middle where no prefix rule can reach it. */
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "");

/* A shelf title may carry a subtitle or a series note that the catalogue's
   canonical title does not, and a subtitle is fatal to the search rather than
   merely unhelpful: Open Library returns nothing at all for "The Hobbit, or
   There and Back Again". The archaic ", or " form has to be cut alongside the
   colon and the trailing parenthetical. */
const searchTitle = (title: string): string =>
  title
    .split(/\s*[:;]\s*|,\s+or\s+/i)[0]
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim() || title;

/* "Ursula K. Le Guin and Someone Else" searches badly; the first author does not. */
const searchAuthor = (author: string): string =>
  author.split(/\s*(?:,|&| and )\s*/i)[0].trim();

const surname = (author: string): string => {
  const parts = fold(searchAuthor(author)).split(" ").filter(Boolean);
  return parts[parts.length - 1] ?? "";
};

/**
 * True when a candidate is the book we asked for. Titles must match after
 * folding, in either direction so a subtitle on one side is not fatal, and the
 * author's surname must appear among the candidate's authors. Both halves are
 * required: title alone matches every edition of every book with a common name.
 */
function matches(title: string, author: string, candTitle: string, candAuthors: string[]): boolean {
  const want = fold(title);
  const wantShort = fold(searchTitle(title));
  const got = fold(candTitle ?? "");
  if (!got || !want) return false;

  const titleOk =
    got === want ||
    got === wantShort ||
    got.startsWith(`${wantShort} `) ||
    want.startsWith(`${got} `);
  if (!titleOk) return false;

  const sur = surname(author);
  if (!sur) return true;
  return candAuthors.some((a) => fold(a).split(" ").includes(sur));
}

/* Open Library descriptions are either a bare string or a typed text object,
   are written in Markdown, and often carry a trailing source credit or a
   "----" separated note. The card renders plain text, so the markup is
   unwrapped rather than shipped as literal asterisks. Google Books sends HTML
   in the same field, which is stripped the same way. */
function cleanDescription(raw: unknown): string | undefined {
  const text =
    typeof raw === "string" ? raw : typeof (raw as any)?.value === "string" ? (raw as any).value : "";
  const cleaned = text
    .replace(/\r\n?/g, "\n")
    .split(/\n-{3,}/)[0]
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\(\[source\]\[\d+\]\)/gi, "")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s*[>#]+\s*/gm, "")
    /* Italics before bold: a "**bold with *italic* inside**" run leaves the
       outer pair unmatchable if the inner markers are still standing. */
    .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s.,;:!?)]|$)/g, "$1$2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\s*\n\s*\n\s*/g, "\n\n")
    .trim();
  return cleaned.length > 20 ? cleaned : undefined;
}

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
  subject?: string[];
};

/* Cataloguing artifacts rather than subjects: true of every book that has been
   scanned, and of no interest on a shelf. */
const SUBJECT_NOISE =
  /^(accessible book|protected daisy|in library|internet archive wishlist|overdrive|large type books|open library staff picks|reading level|new york times reviewed)$/i;

/**
 * Open Library mixes human subject headings with machine facets — "form:novel",
 * "nyt:combined-print-and-e-book-fiction=2020-10-04". The facets carry a colon
 * or an equals sign, which is what separates them from a heading a reader wants
 * to see.
 */
function cleanSubjects(list?: string[]): string[] | undefined {
  const seen = new Set<string>();
  const kept = (list ?? []).filter((s) => {
    const v = s.trim();
    if (!v || v.length > 40 || /[:=]/.test(v) || SUBJECT_NOISE.test(v)) return false;
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return kept.length ? kept.slice(0, 6) : undefined;
}

/* An ISBN-13 is what a reader can actually paste into a library catalogue, so
   it wins over the 10-digit form when the record carries both. */
const pickIsbn = (list?: string[]): string | undefined => {
  const clean = (list ?? []).map((i) => i.replace(/[^0-9Xx]/g, ""));
  return clean.find((i) => i.length === 13) ?? clean.find((i) => i.length === 10);
};

/**
 * `withDescription` is what separates a card lookup from a gallery one. The
 * search endpoint does not return descriptions, so a blurb costs a second
 * request per book — worth it for one open card, and half the traffic of a
 * whole gallery for something no tile displays.
 */
async function fromOpenLibrary(
  title: string,
  author: string,
  withDescription = true
): Promise<BookInfo | null> {
  const fields =
    "key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn,subject";
  const url =
    "https://openlibrary.org/search.json?" +
    new URLSearchParams({
      title: searchTitle(title),
      author: searchAuthor(author),
      fields,
      limit: "5",
    });

  const data = await json(url);
  const docs: OpenLibraryDoc[] = data?.docs ?? [];
  const doc = docs.find((d) => matches(title, author, d.title ?? "", d.author_name ?? []));
  if (!doc) return null;

  const info: BookInfo = {
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    year: doc.first_publish_year,
    /* Deliberately no publisher, and so not even requested above: Open
       Library's list is every edition's publisher in arbitrary order, so the
       first entry is as likely to be a foreign-language reprint as the house
       that published the book. Google Books names one real edition instead. */
    pages: doc.number_of_pages_median,
    subjects: cleanSubjects(doc.subject),
    isbn: pickIsbn(doc.isbn),
    source: "openlibrary",
    sourceUrl: doc.key ? `https://openlibrary.org${doc.key}` : "https://openlibrary.org",
  };

  /* The winning work is fetched separately. A failure here still leaves a
     usable record. */
  if (withDescription && doc.key) {
    const work = await json(`https://openlibrary.org${doc.key}.json`);
    info.description = cleanDescription(work?.description);
  }

  return info;
}

type GoogleVolume = {
  id?: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    description?: string;
    publishedDate?: string;
    publisher?: string;
    pageCount?: number;
    categories?: string[];
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    industryIdentifiers?: { type?: string; identifier?: string }[];
    infoLink?: string;
  };
};

/**
 * Google Books is queried anonymously when no key is configured. That quota is
 * shared across every keyless caller and is often already spent, so a 429 here
 * is routine rather than a fault: the lookup simply loses the publisher and any
 * blurb Open Library could not supply. Set GOOGLE_BOOKS_API_KEY for a quota of
 * one's own.
 */
async function googleVolume(title: string, author: string): Promise<GoogleVolume | null> {
  const q = `intitle:"${searchTitle(title)}"+inauthor:"${searchAuthor(author)}"`;
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    "https://www.googleapis.com/books/v1/volumes?q=" +
    encodeURIComponent(q).replace(/%2B/g, "+") +
    "&maxResults=3&country=US" +
    (key ? `&key=${encodeURIComponent(key)}` : "");

  const data = await json(url);
  const items: GoogleVolume[] = data?.items ?? [];
  return (
    items.find((v) =>
      matches(title, author, v.volumeInfo?.title ?? "", v.volumeInfo?.authors ?? [])
    ) ?? null
  );
}

function fromGoogle(volume: GoogleVolume): BookInfo {
  const v = volume.volumeInfo ?? {};
  const year = Number(v.publishedDate?.slice(0, 4));
  const isbns = (v.industryIdentifiers ?? []).filter((i) => i.identifier);

  return {
    /* Google serves covers over http on some records and adds a curl overlay
       by default; neither belongs in the card. */
    cover: v.imageLinks?.thumbnail?.replace(/^http:/, "https:").replace(/&edge=curl/, ""),
    description: cleanDescription(v.description),
    year: Number.isFinite(year) ? year : undefined,
    publisher: v.publisher,
    pages: v.pageCount,
    subjects: cleanSubjects(v.categories),
    isbn:
      isbns.find((i) => i.type === "ISBN_13")?.identifier ??
      isbns.find((i) => i.type === "ISBN_10")?.identifier,
    source: "google",
    sourceUrl: v.infoLink ?? `https://books.google.com/books?id=${volume.id ?? ""}`,
  };
}

/* --- ISBN lookup ---------------------------------------------------------
   A scanned barcode is a different problem from a shelf row. Everything above
   verifies a fuzzy title+author guess with matches(); an ISBN names exactly one
   edition, so verification here would only reject good hits. */

export type ScannedBook = BookInfo & { title: string; author: string };

type OpenLibraryBook = {
  title?: string;
  authors?: { name?: string }[];
  number_of_pages?: number;
  publish_date?: string;
  publishers?: { name?: string }[];
  cover?: { medium?: string; large?: string };
  subjects?: { name?: string }[];
  url?: string;
};

/**
 * The `api/books` endpoint rather than `/isbn/{isbn}.json`: the latter returns
 * author *keys* that each need their own request to resolve into a name, and a
 * scan should cost one round trip.
 */
async function isbnFromOpenLibrary(isbn: string): Promise<ScannedBook | null> {
  const url =
    "https://openlibrary.org/api/books?" +
    new URLSearchParams({ bibkeys: `ISBN:${isbn}`, format: "json", jscmd: "data" });

  const data = await json(url, DAY * 7);
  const rec: OpenLibraryBook | undefined = data?.[`ISBN:${isbn}`];
  if (!rec?.title) return null;

  const year = Number(rec.publish_date?.match(/\d{4}/)?.[0]);

  return {
    title: rec.title,
    author: (rec.authors ?? []).map((a) => a.name).filter(Boolean).join(", "),
    cover: rec.cover?.large ?? rec.cover?.medium,
    year: Number.isFinite(year) ? year : undefined,
    publisher: rec.publishers?.[0]?.name,
    pages: rec.number_of_pages,
    subjects: cleanSubjects((rec.subjects ?? []).map((s) => s.name ?? "")),
    isbn,
    source: "openlibrary",
    sourceUrl: rec.url ?? `https://openlibrary.org/isbn/${isbn}`,
  };
}

async function isbnFromGoogle(isbn: string): Promise<ScannedBook | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  const url =
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1&country=US` +
    (key ? `&key=${encodeURIComponent(key)}` : "");

  const data = await json(url, DAY * 7);
  const volume: GoogleVolume | undefined = data?.items?.[0];
  const title = volume?.volumeInfo?.title;
  if (!volume || !title) return null;

  const sub = volume.volumeInfo?.subtitle;
  return {
    ...fromGoogle(volume),
    title: sub ? `${title}: ${sub}` : title,
    author: (volume.volumeInfo?.authors ?? []).join(", "),
    isbn,
  };
}

/**
 * Same division of labour as getBookInfo — Open Library for the cover and the
 * subject headings, Google for the publisher and a blurb — but here Google is
 * also the fallback record outright, because Open Library's coverage of recent
 * printings is the thinner of the two.
 */
export async function getBookByIsbn(raw: string): Promise<ScannedBook | null> {
  const isbn = normalizeIsbn(raw);
  if (!isbn) return null;

  const [ol, google] = await Promise.all([isbnFromOpenLibrary(isbn), isbnFromGoogle(isbn)]);
  if (!ol) return google;
  if (!google) return ol;

  return {
    ...ol,
    author: ol.author || google.author,
    publisher: google.publisher ?? ol.publisher,
    pages: ol.pages ?? google.pages,
    description: google.description,
    subjects: ol.subjects ?? google.subjects,
  };
}

/**
 * Open Library is primary: it is key-free, unmetered, and holds both the better
 * cover archive and the first-publication year. Google Books is asked at the
 * same time rather than after, because it is the only one of the two that names
 * a single real edition, and so the only trustworthy source for the publisher.
 * Running them together costs one round trip instead of two.
 */
export async function getBookInfo(title: string, author: string): Promise<BookInfo | null> {
  if (!title.trim()) return null;

  const [ol, volume] = await Promise.all([
    fromOpenLibrary(title, author),
    googleVolume(title, author),
  ]);

  const google = volume ? fromGoogle(volume) : null;
  if (!ol) return google;
  if (!google) return ol;

  /* Open Library's record stands, and the attribution keeps naming it. Only the
     fields it cannot answer well are taken from the edition Google matched. */
  return {
    ...ol,
    publisher: google.publisher,
    pages: google.pages ?? ol.pages,
    description: ol.description ?? google.description,
  };
}

/* --- batched covers ------------------------------------------------------
   A gallery needs eighty covers at once, which is a different problem from a
   card needing one. Everything above is shaped for the card: it asks both
   sources, waits for both, and spends a second Open Library request on a blurb.
   Eighty of those is 240 requests, and Open Library starts refusing them long
   before the grid is full. */

/** What a tile actually needs. No blurb, no subjects, no publisher. */
export type Cover = {
  cover?: string;
  isbn?: string;
  year?: number;
  source: BookInfo["source"];
};

const slim = (info: BookInfo): Cover => ({
  cover: info.cover,
  isbn: info.isbn,
  year: info.year,
  source: info.source,
});

/**
 * Google Books is asked only when Open Library has no cover, rather than always
 * and in parallel as getBookInfo does. Open Library answers with a cover most of
 * the time and is the unmetered one of the two; spending a Google call on every
 * book would exhaust the keyless quota a few rows into the grid and cost the
 * tiles that genuinely need it.
 */
async function coverFor(title: string, author: string): Promise<Cover | null> {
  const ol = await fromOpenLibrary(title, author, false);
  if (ol?.cover) return slim(ol);

  const volume = await googleVolume(title, author);
  const google = volume ? fromGoogle(volume) : null;
  if (google?.cover) return slim(google);

  /* Neither had a jacket. The Open Library record is still worth returning if
     there was one — the year and the ISBN are real, and the tile falls back to
     its cloth binding for the picture. */
  return ol ? slim(ol) : google ? slim(google) : null;
}

/**
 * Runs `work` over `items` a few at a time.
 *
 * Not Promise.all: twenty-four books resolved at once is up to forty-eight
 * upstream requests in the same tick, which Open Library rate-limits and the
 * keyless Google quota simply refuses. A small pool keeps a batch polite and
 * still finishes it in about a second.
 */
async function pooled<T, R>(
  items: T[],
  size: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await work(items[i]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
  return results;
}

const POOL = 6;

/**
 * Covers for a batch of books, keyed by the id each was asked for.
 *
 * Deduplicated on the title and author actually searched, so a shelf holding two
 * copies of the same book — or the same title in the shelf and the chest —
 * costs one lookup and fills both entries.
 */
export async function getCovers(
  books: { id: string; title: string; author: string }[]
): Promise<Record<string, Cover | null>> {
  const byKey = new Map<string, string[]>();
  for (const b of books) {
    if (!b.title.trim()) continue;
    const key = `${b.title}|${b.author}`;
    byKey.set(key, [...(byKey.get(key) ?? []), b.id]);
  }

  const keys = [...byKey.keys()];
  const found = await pooled(keys, POOL, (key) => {
    const [title, author] = key.split("|");
    return coverFor(title, author);
  });

  const covers: Record<string, Cover | null> = {};
  keys.forEach((key, i) => {
    for (const id of byKey.get(key)!) covers[id] = found[i];
  });
  /* A book with no title never reached the pool, and the gallery still asked
     about it. An explicit null is what stops it being requested again. */
  for (const b of books) if (!(b.id in covers)) covers[b.id] = null;

  return covers;
}
