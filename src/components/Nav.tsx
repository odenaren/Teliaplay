"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fem flikar. Sport står först efter startsidan, eftersom det är därför paketet
 * finns. Källor och inställningar ligger inte här — det är sidor man besöker
 * när något är fel, inte varje dag.
 */
const FLIKAR = [
  { href: "/", label: "Start", ikon: "▤" },
  { href: "/sport", label: "Sport", ikon: "◍" },
  { href: "/tabla", label: "Tablå", ikon: "◷" },
  { href: "/bladdra", label: "Bläddra", ikon: "▶" },
  { href: "/sok", label: "Sök", ikon: "◎" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl">
        {FLIKAR.map((flik) => {
          const aktiv = flik.href === "/" ? pathname === "/" : pathname.startsWith(flik.href);
          return (
            <Link
              key={flik.href}
              href={flik.href}
              aria-current={aktiv ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                aktiv ? "text-accent" : "text-muted hover:text-text"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {flik.ikon}
              </span>
              {flik.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
