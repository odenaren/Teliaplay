"use client";

import { useTransition } from "react";
import { vaxlaFavorit } from "@/app/actions";

/** Stjärnan. Optimistisk i känsla — omritningen sker när servern svarat. */
export function FavoritKnapp({
  sort,
  refId,
  aktiv,
  etikett,
}: {
  sort: string;
  refId: string;
  aktiv: boolean;
  etikett?: string;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={aktiv}
      aria-label={etikett ?? (aktiv ? "Ta bort favorit" : "Spara som favorit")}
      onClick={() => start(() => void vaxlaFavorit(sort, refId))}
      className={`shrink-0 rounded-full px-2 py-1 text-xs transition-colors disabled:opacity-50 ${
        aktiv ? "text-accent" : "text-muted hover:text-text"
      }`}
    >
      {aktiv ? "★" : "☆"}
    </button>
  );
}
