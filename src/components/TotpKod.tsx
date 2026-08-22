"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tvåfaktorkoden med sin nedräkning.
 *
 * Koden räknas ut på servern — hemligheten lämnar aldrig den. Här visas den
 * bara, med sekunderna kvar, och när de tar slut hämtas sidan om så att en ny
 * kod räknas fram. Att räkna ut den i webbläsaren hade sparat en omhämtning
 * och kostat att 2FA-hemligheten låg i sidkällan.
 */
export function TotpKod({ kod, sekunder }: { kod: string; sekunder: number }) {
  const [kvar, setKvar] = useState(sekunder);
  const router = useRouter();

  useEffect(() => {
    setKvar(sekunder);
    const timer = setInterval(() => {
      setKvar((n) => {
        if (n <= 1) {
          router.refresh();
          return sekunder;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [kod, sekunder, router]);

  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard?.writeText(kod)}
      className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[15px] tabular-nums tracking-[0.2em] transition-colors hover:border-accent/50"
      title="Klicka för att kopiera"
    >
      {kod}
      <span className="text-[10px] tracking-normal text-muted">{kvar}s</span>
    </button>
  );
}
