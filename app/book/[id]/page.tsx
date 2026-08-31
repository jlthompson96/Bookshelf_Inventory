import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CHEST, getBookById } from "@/lib/notion";
import { getBookInfo } from "@/lib/bookinfo";
import { idFromParam } from "@/lib/href";
import { cloth } from "@/lib/spine";
import BookCard from "@/components/BookCard";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/**
 * One book, as its own page.
 *
 * This is what a shared link resolves to. Everything the card shows is rendered
 * on the server, so the page is complete in its first response — a crawler
 * building a preview, or a reader with scripting off, gets the whole card
 * rather than an empty dialog waiting on a fetch.
 */

async function load(param: string) {
  const id = idFromParam(param);
  if (!id) return null;
  return getBookById(id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const found = await load((await params).id);
  if (!found) return { title: "Not in this inventory" };

  const { book, collection } = found;
  const where =
    book.sh != null && book.p != null
      ? `${collection === CHEST ? "Pile" : "Shelf"} ${book.sh}, position ${book.p}`
      : "Not yet placed";

  return {
    title: book.t,
    description: `${book.t} by ${book.a}. ${where}. ${book.s}.`,
    openGraph: {
      title: book.t,
      description: `${book.a} · ${where}`,
      type: "article",
    },
    /* Next wires the opengraph-image in beside this on its own, but not the
       card type — without it the image renders as a thumbnail on X rather than
       the full-bleed card it is drawn for. */
    twitter: { card: "summary_large_image" },
  };
}

export default async function BookPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await load((await params).id);
  if (!found) notFound();

  const { book, collection } = found;
  const info = await getBookInfo(book.t, book.a);
  const home = collection === CHEST ? "/chest" : "/";

  return (
    <main className={styles.page}>
      <Link className={`eyebrow ${styles.back}`} href={home}>
        &larr; {collection === CHEST ? "The storage chest" : "The shelf"}
      </Link>

      <article
        className={styles.card}
        style={{ "--cloth": cloth(book) } as React.CSSProperties}
      >
        <BookCard book={book} kind={collection === CHEST ? "chest" : "shelf"} info={info} as="h1" />
      </article>
    </main>
  );
}
