import { getBooks, NotionError, type Book, type FailureKind } from "@/lib/notion";
import Bookshelf from "@/components/Bookshelf";

export const dynamic = "force-dynamic";

type Guidance = { title: string; lead: string; steps: string[] };

const GUIDANCE: Record<FailureKind, Guidance> = {
  "no-token": {
    title: "No token on this deployment",
    lead: "Notion was never contacted, because there is no credential to contact it with.",
    steps: [
      "Add NOTION_TOKEN under Settings, Environment Variables in this Vercel project.",
      "Redeploy. A build that finished before the variable was added will not pick it up.",
    ],
  },
  unauthorized: {
    title: "Notion rejected the token",
    lead: "The credential reached Notion and was refused, so the value itself is wrong or has been revoked.",
    steps: [
      "Confirm the value is the internal integration secret starting with ntn_, not a page URL or an OAuth client secret.",
      "Check for a trailing space or newline pasted into the Vercel value.",
      "Regenerate the secret at notion.so/my-integrations if it may have been rotated.",
    ],
  },
  "no-access": {
    title: "The token works, but it cannot see the database",
    lead: "Notion authenticated the integration and then reported that the Bookshelf Inventory database is not visible to it. Notion returns the same code whether something is missing or merely unshared, so this is almost always a sharing problem.",
    steps: [
      "Open notion.so/my-integrations and confirm the integration sits in the same workspace as the Bookshelf Inventory page. A workspace mismatch is invisible from the page side, because the integration simply never appears in the connections list.",
      "On the Bookshelf Inventory page, open the overflow menu, then Connections, then Connect to, and choose the integration. Connect it on the page rather than the inline database, so access cascades down.",
      "Reload this page. No redeploy is needed, because only Notion permissions changed.",
    ],
  },
  unknown: {
    title: "Notion returned something unexpected",
    lead: "The request failed for a reason that is not a missing token, a bad token, or a sharing problem.",
    steps: ["Check the raw response below, and the Notion status page if it looks like an outage."],
  },
};

export default async function Page() {
  let books: Book[] = [];
  let kind: FailureKind | null = null;
  let detail = "";

  try {
    books = await getBooks();
  } catch (err) {
    if (err instanceof NotionError) {
      kind = err.kind;
      detail = err.detail;
    } else {
      kind = "unknown";
      detail = err instanceof Error ? err.message : String(err);
    }
  }

  if (kind) {
    const g = GUIDANCE[kind];
    return (
      <main style={{ padding: "72px 28px", maxWidth: 680, margin: "0 auto", fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
        <div className="eyebrow" style={{ marginBottom: 18 }}>Circulation desk</div>
        <h1 style={{ font: "400 34px/1.2 var(--font-display), Georgia, serif", margin: 0, color: "var(--linen)" }}>
          {g.title}
        </h1>
        <p style={{ font: "400 15px/1.7 var(--font-sans), sans-serif", color: "var(--linen-dim)", marginTop: 16 }}>{g.lead}</p>
        <ol style={{ font: "400 15px/1.75 var(--font-sans), sans-serif", color: "var(--linen-dim)", paddingLeft: 20, marginTop: 22 }}>
          {g.steps.map((s, i) => (
            <li key={i} style={{ marginBottom: 12 }}>{s}</li>
          ))}
        </ol>
        <details style={{ marginTop: 34, borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
          <summary className="eyebrow" style={{ cursor: "pointer" }}>Raw response</summary>
          <pre style={{ font: "400 12px/1.7 var(--font-mono), monospace", color: "var(--linen-faint)", whiteSpace: "pre-wrap", wordBreak: "break-word", marginTop: 14 }}>
            {detail}
          </pre>
        </details>
      </main>
    );
  }

  return <Bookshelf books={books} />;
}
