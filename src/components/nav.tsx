"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Wishes" },
  { href: "/history", label: "History" },
  { href: "/people", label: "People" },
];

/** Nav highlighting the current section; reads the URL so it renders at request time. */
export function ActiveNav() {
  return <Nav pathname={usePathname()} />;
}

export function Nav({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map(({ href, label }) => {
        const active =
          pathname !== null &&
          (href === "/" ? pathname === "/" || pathname.startsWith("/wishes") : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
              active ? "bg-surface-2 text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
