/**
 * The only place in the app that decides who may write to Notion.
 *
 * The deployment is gated by Vercel Authentication, which runs in front of the
 * app and so cannot be scoped to a single route: it protects everything or
 * nothing. That makes it the outer wall, not the whole defence — this flag is
 * what keeps a deployment that has protection switched off (to restore the
 * Notion embed, say) from also quietly exposing a public write endpoint on a
 * personal database. Writes are off unless someone deliberately turns them on.
 *
 * To move to an app-level gate instead — an env-var password and a signed
 * httpOnly cookie, which is what the embed-preserving path needs — this
 * function is the only thing that changes.
 */

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export const writesEnabled = () => process.env.BOOKSHELF_WRITE_ENABLED === "true";

export function assertCanWrite(): void {
  if (!writesEnabled()) {
    throw new ForbiddenError(
      "Writes are disabled. Set BOOKSHELF_WRITE_ENABLED=true on a deployment that is behind Vercel Authentication."
    );
  }
}
