/**
 * The Notion misconfiguration explainer, shared by every page that reads a
 * database. Notion reports most of these the same way from the outside — a 404
 * covers both "does not exist" and "not shared with this integration" — so the
 * remediation prose is where the diagnosis actually lives.
 */

import type { FailureKind } from "@/lib/notion";
import styles from "@/app/page.module.css";

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
    lead: "Notion authenticated the integration and then reported that the database is not visible to it. Notion returns the same code whether something is missing or merely unshared, so this is almost always a sharing problem.",
    steps: [
      "Open notion.so/my-integrations and confirm the integration sits in the same workspace as the Bookshelf Inventory page. A workspace mismatch is invisible from the page side, because the integration simply never appears in the connections list.",
      "On the Bookshelf Inventory page, open the overflow menu, then Connections, then Connect to, and choose the integration. Connect it on the parent page rather than on one inline database, so access cascades to both the shelf and the storage chest.",
      "Reload this page. No redeploy is needed, because only Notion permissions changed.",
    ],
  },
  unknown: {
    title: "Notion returned something unexpected",
    lead: "The request failed for a reason that is not a missing token, a bad token, or a sharing problem.",
    steps: ["Check the raw response below, and the Notion status page if it looks like an outage."],
  },
};

export default function NotionFailure({
  kind,
  detail,
}: {
  kind: FailureKind;
  detail: string;
}) {
  const g = GUIDANCE[kind];

  return (
    <main className={styles.page}>
      <p className="eyebrow">Circulation desk</p>
      <h1 className={styles.title}>{g.title}</h1>
      <p className={styles.lead}>{g.lead}</p>
      <ol className={styles.steps}>
        {g.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <details className={styles.details}>
        <summary className={`eyebrow ${styles.summary}`}>Raw response</summary>
        <pre className={styles.raw}>{detail}</pre>
      </details>
    </main>
  );
}
