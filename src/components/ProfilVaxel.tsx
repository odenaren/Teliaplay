"use client";

import { useTransition } from "react";
import { valjProfil } from "@/app/actions";
import type { Profil } from "@/lib/types";

/**
 * Profilväxeln.
 *
 * Två knappar bredvid varandra, inget mer. Ingen inloggning, ingen bekräftelse,
 * inget "byter profil…"-läge. Att byta ska kosta ett tryck, annars använder ni
 * bara den ena profilen och funktionen kunde lika gärna inte finnas.
 */
export function ProfilVaxel({ profiler, aktiv }: { profiler: Profil[]; aktiv: string }) {
  const [pending, start] = useTransition();

  if (profiler.length <= 1) return null;

  return (
    <div className="flex items-center gap-1" aria-label="Välj profil">
      {profiler.map((p) => {
        const vald = p.id === aktiv;
        return (
          <button
            key={p.id}
            type="button"
            disabled={pending}
            onClick={() => start(() => void valjProfil(p.id))}
            aria-pressed={vald}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
              vald ? "text-ink" : "border border-line text-muted hover:text-text"
            }`}
            style={vald ? { background: p.farg } : undefined}
          >
            {p.namn}
          </button>
        );
      })}
    </div>
  );
}
