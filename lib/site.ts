/**
 * The deployment's own origin.
 *
 * Only share previews need this, but they need it absolutely: an og:image is
 * fetched by a crawler that has no page context to resolve a relative path
 * against, so without a metadataBase Next emits a URL no crawler can follow and
 * the card renders blank. Getting it wrong is invisible locally and only shows
 * up as a dead preview in someone else's chat window.
 */

export function siteUrl(): string {
  /* Set this in the deployment environment. It is the only one of the three
     that survives a custom domain — VERCEL_PROJECT_PRODUCTION_URL is the
     project's vercel.app hostname, which is right for previews and wrong for a
     domain someone has actually pointed at the project. */
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
