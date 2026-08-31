"use client";

import { useEffect, useRef, useState } from "react";
import { applyTheme, readStoredTheme, THEME_CHOICES, THEME_LABELS, type ThemeChoice } from "@/lib/theme";
import styles from "./Nav.module.css";

/**
 * System / Light / Dark, in the same radiogroup vocabulary as the status
 * filter in Toolbar.tsx: roving tabindex, arrow-key support, selection carried
 * by weight and a marker as well as fill.
 *
 * Rendered as "System" on the very first render regardless of what is actually
 * stored, then corrected in an effect once the DOM (already set by the
 * bootstrap script in layout.tsx, before this ever mounts) can be read. A
 * client component can still only render one thing on the server, and reading
 * localStorage during that render would disagree with hydration; this way the
 * mismatch is a one-frame default rather than a warning.
 */
export default function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setChoice(readStoredTheme());
  }, []);

  const select = (next: ThemeChoice) => {
    setChoice(next);
    applyTheme(next);
  };

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = THEME_CHOICES.length - 1;
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    select(THEME_CHOICES[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.themeGroup} role="radiogroup" aria-label="Colour theme">
      {THEME_CHOICES.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={choice === c}
          tabIndex={choice === c ? 0 : -1}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={styles.themeChip}
          onClick={() => select(c)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {THEME_LABELS[c]}
        </button>
      ))}
    </div>
  );
}
