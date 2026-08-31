"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import styles from "./Nav.module.css";

/* The inventory is in two places now, so there has to be a way to get between
   them. `/add` joins them only where writes are switched on — linking to a page
   that exists only to explain that it is switched off is worse than no link.
   The doctor carries no such gate: it only reads, same as every other page
   here, so it is offered unconditionally rather than tucked under a flag that
   has nothing to do with it. */
export default function Nav({ canWrite }: { canWrite: boolean }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "The shelf" },
    { href: "/chest", label: "Storage chest" },
    { href: "/gallery", label: "Gallery" },
    { href: "/stats", label: "Statistics" },
    ...(canWrite ? [{ href: "/add", label: "Shelve a book" }] : []),
    { href: "/doctor", label: "Shelf doctor" },
  ];

  return (
    <nav className={styles.nav} aria-label="Inventory">
      <ul className={styles.list}>
        {links.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              className={styles.link}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
        <li className={styles.themeItem}>
          <ThemeToggle />
        </li>
      </ul>
    </nav>
  );
}
