/**
 * The dark-mode toggle's three states, and how they are persisted.
 *
 * "System" is the absence of a choice: no data-theme attribute, so
 * prefers-color-scheme in app/globals.css decides alone. "Light" and "Dark" are
 * explicit choices, stamped as data-theme and stored so they survive a reload —
 * and so they can override the OS setting in either direction, which a media
 * query by itself cannot do.
 *
 * THEME_KEY is duplicated as a literal in the bootstrap script in
 * app/layout.tsx, which runs before any module graph exists and so cannot
 * import this file. The two must name the same key; nothing enforces that but
 * this comment.
 */

export const THEME_KEY = "bookshelf-theme";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

export const THEME_LABELS: Record<ThemeChoice, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** What's actually stored, narrowed from whatever a stale or foreign value might hold. */
export function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* Private browsing, or storage disabled — System is the correct fallback. */
  }
  return "system";
}

/** Applies a choice to the document and persists it (or clears it, for System). */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* Nothing to persist to; the attribute this render is already correct. */
  }
}
